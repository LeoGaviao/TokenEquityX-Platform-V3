const { v4: uuidv4 }        = require('uuid');
const logger                = require('../utils/logger');
const ws                    = require('./websocket');
const { getNumericSetting }           = require('../utils/platformSettings');
const { createSettlementInstruction } = require('../utils/settlement');

async function matchOrders(tokenId, db) {
  try {
    // ── Token info and market state
    const [tokens] = await db.execute('SELECT * FROM tokens WHERE id = ?', [tokenId]);
    if (tokens.length === 0) return;
    const token = tokens[0];
    const tokenSymbol = token.symbol || token.token_symbol;

    if (!['FULL_TRADING', 'LIMITED_TRADING'].includes(token.market_state)) {
      logger.warn('Matching skipped — market state', { tokenId, state: token.market_state });
      return;
    }

    // ── Market controls
    const [controls] = await db.execute(
      'SELECT * FROM market_controls WHERE token_id = ?', [tokenId]
    );
    if (controls.length > 0 && controls[0].halted) {
      logger.warn('Matching skipped — token halted', { tokenId });
      return;
    }

    // ── Open buy orders — price desc, time asc
    const [buys] = await db.execute(`
      SELECT * FROM orders
      WHERE token_id = ? AND side = 'BUY'
      AND status IN ('OPEN', 'PARTIAL')
      ORDER BY
        CASE WHEN order_type = 'MARKET' THEN 0 ELSE 1 END,
        limit_price DESC, created_at ASC
    `, [tokenId]);

    // ── Open sell orders — price asc, time asc
    const [sells] = await db.execute(`
      SELECT * FROM orders
      WHERE token_id = ? AND side = 'SELL'
      AND status IN ('OPEN', 'PARTIAL')
      ORDER BY
        CASE WHEN order_type = 'MARKET' THEN 0 ELSE 1 END,
        limit_price ASC, created_at ASC
    `, [tokenId]);

    // Fetch all rate settings before the transaction loop (pool reads, not connection)
    const platformFeeRate = await getNumericSetting('platform_fee_rate', 0.005);
    const seczLevyRate    = await getNumericSetting('secz_levy_rate', 0.0032);
    const vatRate         = await getNumericSetting('vat_rate', 0.155);
    const cgtRate         = await getNumericSetting('cgt_rate', 0.20);
    const imttRate        = await getNumericSetting('imtt_rate', 0.02);

    const trades = [];

    for (const buy of buys) {
      for (const sell of sells) {

        if (buy.user_id === sell.user_id) continue;

        const buyPrice     = Number(buy.limit_price);
        const sellPrice    = Number(sell.limit_price);
        const buyIsMarket  = buy.order_type  === 'MARKET';
        const sellIsMarket = sell.order_type === 'MARKET';

        if (!buyIsMarket && !sellIsMarket && buyPrice < sellPrice) continue;

        // Trade price — maker priority
        let tradePrice;
        if      (buyIsMarket && sellIsMarket) tradePrice = Number(token.current_price_usd) || sellPrice;
        else if (buyIsMarket)                 tradePrice = sellPrice;
        else if (sellIsMarket)                tradePrice = buyPrice;
        else tradePrice = buy.created_at < sell.created_at ? buyPrice : sellPrice;

        if (tradePrice <= 0) continue;

        // Fill quantities and fee calculations
        const buyRemaining  = Number(buy.quantity)  - Number(buy.filled_qty);
        const sellRemaining = Number(sell.quantity) - Number(sell.filled_qty);
        if (buyRemaining <= 0 || sellRemaining <= 0) continue;

        const fillQty          = Math.min(buyRemaining, sellRemaining);
        const totalValue       = parseFloat((fillQty * tradePrice).toFixed(2));
        const platformFee      = parseFloat((totalValue * platformFeeRate).toFixed(2));
        const seczLevy         = parseFloat((totalValue * seczLevyRate).toFixed(2));
        const vatOnPlatformFee = parseFloat((platformFee * vatRate).toFixed(2));
        const totalFees        = parseFloat((platformFee + seczLevy + vatOnPlatformFee).toFixed(2));
        const imttAmount       = parseFloat((totalValue * imttRate).toFixed(2));
        const buyerDebit       = parseFloat((totalValue + imttAmount).toFixed(2));
        // CGT and sellerNet are computed after seller holdings load below
        let capitalGain = 0;
        let cgtAmount   = 0;
        let sellerNet   = 0;

        // ── Volume cap check
        if (controls.length > 0 && controls[0].daily_volume_cap_usd > 0) {
          const [[volRow]] = await db.execute(`
            SELECT COALESCE(SUM(total_value), 0) as vol FROM trades
            WHERE token_id = ? AND matched_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          `, [tokenId]);
          if (Number(volRow.vol) + totalValue > Number(controls[0].daily_volume_cap_usd)) {
            logger.warn('Volume cap reached', { tokenId });
            ws.emitMarketState(tokenSymbol, 'VOLUME_CAP_REACHED');
            return;
          }
        }

        // ── Max trade size check
        if (controls.length > 0 && controls[0].max_trade_size_usd > 0) {
          if (totalValue > Number(controls[0].max_trade_size_usd)) {
            logger.warn('Trade exceeds max size', { tokenId, totalValue });
            continue;
          }
        }

        // ── Load buyer user record (need wallet_address for trades table)
        const [buyerUsers] = await db.execute(
          'SELECT id, wallet_address FROM users WHERE id = ?', [buy.user_id]
        );
        if (buyerUsers.length === 0) { logger.warn('Buyer user not found', { userId: buy.user_id }); continue; }
        const buyerUser = buyerUsers[0];

        const [sellerUsers] = await db.execute(
          'SELECT id, wallet_address FROM users WHERE id = ?', [sell.user_id]
        );
        if (sellerUsers.length === 0) { logger.warn('Seller user not found', { userId: sell.user_id }); continue; }
        const sellerUser = sellerUsers[0];

        // ── Load buyer wallet (determines settlement rail)
        const [buyerWallets] = await db.execute(
          'SELECT * FROM investor_wallets WHERE user_id = ?', [buy.user_id]
        );
        if (buyerWallets.length === 0) { logger.warn('Buyer wallet not found', { userId: buy.user_id }); continue; }
        const buyerWallet = buyerWallets[0];
        const buyerRail = buyerWallet.settlement_rail || 'FIAT';

        const buyerBalance = buyerRail === 'USDC'
          ? parseFloat(buyerWallet.balance_usdc)
          : parseFloat(buyerWallet.balance_usd);

        if (buyerBalance < buyerDebit) {
          logger.warn('Buyer insufficient balance', { userId: buy.user_id, rail: buyerRail, required: buyerDebit, available: buyerBalance });
          continue;
        }

        // ── Load seller wallet
        const [sellerWallets] = await db.execute(
          'SELECT * FROM investor_wallets WHERE user_id = ?', [sell.user_id]
        );
        if (sellerWallets.length === 0) { logger.warn('Seller wallet not found', { userId: sell.user_id }); continue; }
        const sellerWallet = sellerWallets[0];
        const sellerRail = sellerWallet.settlement_rail || 'FIAT';
        const sellerBalance = sellerRail === 'USDC'
          ? parseFloat(sellerWallet.balance_usdc)
          : parseFloat(sellerWallet.balance_usd);

        // ── Load or create buyer token holding
        let [buyerHoldings] = await db.execute(
          'SELECT * FROM token_holdings WHERE user_id = ? AND token_id = ?',
          [buy.user_id, tokenId]
        );
        if (buyerHoldings.length === 0) {
          await db.execute(
            'INSERT INTO token_holdings (id, user_id, token_id, balance, reserved, average_cost_usd) VALUES (uuid(), ?, ?, 0, 0, 0)',
            [buy.user_id, tokenId]
          );
          [buyerHoldings] = await db.execute(
            'SELECT * FROM token_holdings WHERE user_id = ? AND token_id = ?',
            [buy.user_id, tokenId]
          );
        }
        const buyerTokenBalance = parseFloat(buyerHoldings[0].balance);

        // ── Load seller token holding
        const [sellerHoldings] = await db.execute(
          'SELECT * FROM token_holdings WHERE user_id = ? AND token_id = ?',
          [sell.user_id, tokenId]
        );
        if (sellerHoldings.length === 0) {
          logger.warn('Seller has no token holding', { userId: sell.user_id, tokenId });
          continue;
        }
        const sellerTokenBalance  = parseFloat(sellerHoldings[0].balance);
        const sellerTokenReserved = parseFloat(sellerHoldings[0].reserved);

        if (sellerTokenBalance < fillQty) {
          logger.warn('Seller insufficient token balance', { userId: sell.user_id, required: fillQty, available: sellerTokenBalance });
          continue;
        }

        // CGT on seller's capital gain (requires seller holdings average cost)
        const sellerAvgCost = parseFloat(sellerHoldings[0].average_cost_usd || 0);
        capitalGain = Math.max(0, (tradePrice - sellerAvgCost) * fillQty);
        cgtAmount   = parseFloat((capitalGain * cgtRate).toFixed(2));
        sellerNet   = parseFloat((totalValue - totalFees - cgtAmount).toFixed(2));

        // ══ ATOMIC SETTLEMENT ══
        const conn = await db.getConnection();
        try {
          await conn.beginTransaction();

          // 1. Insert trade record — using actual trades table schema
          await conn.execute(`
            INSERT INTO trades
              (token_symbol, buy_order_id, sell_order_id,
               buyer_wallet, seller_wallet,
               quantity, price, total_value, total_usdc,
               platform_fee, token_id,
               secz_levy, vat_amount, cgt_amount, imtt_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            tokenSymbol,
            buy.id, sell.id,
            buyerUser.wallet_address  || '',
            sellerUser.wallet_address || '',
            fillQty, tradePrice, totalValue, totalValue,
            platformFee, tokenId,
            seczLevy, vatOnPlatformFee, cgtAmount, imttAmount
          ]);

          // 2. Buyer debit (in buyer's settlement rail)
          if (buyerRail === 'FIAT') {
            const newBuyerUSD = parseFloat((buyerBalance - buyerDebit).toFixed(2));
            const newBuyerRes = parseFloat(Math.max(0, parseFloat(buyerWallet.reserved_usd) - totalValue).toFixed(2));
            await conn.execute(
              'UPDATE investor_wallets SET balance_usd = ?, reserved_usd = ?, updated_at = NOW() WHERE user_id = ?',
              [newBuyerUSD, newBuyerRes, buy.user_id]
            );
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'TRADE_BUY', ?, ?, ?, ?, ?)
            `, [buy.user_id, -totalValue, buyerBalance, parseFloat((buyerBalance - totalValue).toFixed(2)), buy.id,
               `Buy ${fillQty} ${tokenSymbol} @ $${tradePrice.toFixed(4)}`]);
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'IMTT', ?, ?, ?, ?, ?)
            `, [buy.user_id, -imttAmount, parseFloat((buyerBalance - totalValue).toFixed(2)), newBuyerUSD, buy.id,
               `IMTT 2% on $${totalValue.toFixed(2)} trade`]);
          } else {
            const newBuyerUSDC = parseFloat((buyerBalance - buyerDebit).toFixed(8));
            await conn.execute(
              'UPDATE investor_wallets SET balance_usdc = ?, updated_at = NOW() WHERE user_id = ?',
              [newBuyerUSDC, buy.user_id]
            );
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'TRADE_BUY', ?, ?, ?, ?, ?)
            `, [buy.user_id, -totalValue, buyerBalance, parseFloat((buyerBalance - totalValue).toFixed(8)), buy.id,
               `Buy ${fillQty} ${tokenSymbol} @ $${tradePrice.toFixed(4)} [USDC]`]);
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'IMTT', ?, ?, ?, ?, ?)
            `, [buy.user_id, -imttAmount, parseFloat((buyerBalance - totalValue).toFixed(8)), newBuyerUSDC, buy.id,
               `IMTT 2% on $${totalValue.toFixed(2)} trade [USDC]`]);
          }

          // 3. Seller credit (in seller's settlement rail)
          if (sellerRail === 'FIAT') {
            const newSellerUSD = parseFloat((sellerBalance + sellerNet).toFixed(2));
            await conn.execute(
              'UPDATE investor_wallets SET balance_usd = ?, updated_at = NOW() WHERE user_id = ?',
              [newSellerUSD, sell.user_id]
            );
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'TRADE_SELL', ?, ?, ?, ?, ?)
            `, [sell.user_id, sellerNet, sellerBalance, newSellerUSD, sell.id,
               `Sell ${fillQty} ${tokenSymbol} @ $${tradePrice.toFixed(4)} (net of fees & CGT)`]);
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'FEE', ?, ?, ?, ?, ?)
            `, [sell.user_id, -totalFees, parseFloat((sellerBalance + totalValue).toFixed(2)), newSellerUSD, sell.id,
               `Fees: platform $${platformFee.toFixed(2)} + SECZ $${seczLevy.toFixed(2)} + VAT $${vatOnPlatformFee.toFixed(2)}`]);
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'CGT', ?, ?, ?, ?, ?)
            `, [sell.user_id, -cgtAmount, parseFloat((sellerBalance + totalValue).toFixed(2)), newSellerUSD, sell.id,
               `CGT 20% on $${capitalGain.toFixed(2)} capital gain`]);
          } else {
            const newSellerUSDC = parseFloat((sellerBalance + sellerNet).toFixed(8));
            await conn.execute(
              'UPDATE investor_wallets SET balance_usdc = ?, updated_at = NOW() WHERE user_id = ?',
              [newSellerUSDC, sell.user_id]
            );
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'TRADE_SELL', ?, ?, ?, ?, ?)
            `, [sell.user_id, sellerNet, sellerBalance, newSellerUSDC, sell.id,
               `Sell ${fillQty} ${tokenSymbol} @ $${tradePrice.toFixed(4)} [USDC, net of fees & CGT]`]);
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'FEE', ?, ?, ?, ?, ?)
            `, [sell.user_id, -totalFees, parseFloat((sellerBalance + totalValue).toFixed(8)), newSellerUSDC, sell.id,
               `Fees [USDC]: platform $${platformFee.toFixed(2)} + SECZ $${seczLevy.toFixed(2)} + VAT $${vatOnPlatformFee.toFixed(2)}`]);
            await conn.execute(`
              INSERT INTO wallet_transactions (id, user_id, type, amount_usd, balance_before, balance_after, reference_id, description)
              VALUES (uuid(), ?, 'CGT', ?, ?, ?, ?, ?)
            `, [sell.user_id, -cgtAmount, parseFloat((sellerBalance + totalValue).toFixed(8)), newSellerUSDC, sell.id,
               `CGT 20% on $${capitalGain.toFixed(2)} capital gain [USDC]`]);
          }

          // 4. Treasury credit — IMTT in buyer's rail, fees+CGT in seller's rail
          const buyerTreasuryCol  = buyerRail  === 'FIAT' ? 'usd_liability' : 'usdc_balance';
          const sellerTreasuryCol = sellerRail === 'FIAT' ? 'usd_liability' : 'usdc_balance';
          if (buyerTreasuryCol === sellerTreasuryCol) {
            await conn.execute(
              `UPDATE platform_treasury SET ${buyerTreasuryCol} = ${buyerTreasuryCol} + ?, updated_at = NOW() WHERE id = 1`,
              [parseFloat((totalFees + cgtAmount + imttAmount).toFixed(2))]
            );
          } else {
            await conn.execute(
              `UPDATE platform_treasury SET ${buyerTreasuryCol} = ${buyerTreasuryCol} + ?, updated_at = NOW() WHERE id = 1`,
              [parseFloat(imttAmount.toFixed(2))]
            );
            await conn.execute(
              `UPDATE platform_treasury SET ${sellerTreasuryCol} = ${sellerTreasuryCol} + ?, updated_at = NOW() WHERE id = 1`,
              [parseFloat((totalFees + cgtAmount).toFixed(2))]
            );
          }

          // 4. Token movements — same regardless of rail
          const newBuyerTokenBal = parseFloat((buyerTokenBalance + fillQty).toFixed(8));
          const newBuyerAvgCost  = parseFloat(
            ((buyerTokenBalance * parseFloat(buyerHoldings[0].average_cost_usd) + fillQty * tradePrice)
             / newBuyerTokenBal).toFixed(6)
          );
          await conn.execute(
            'UPDATE token_holdings SET balance = ?, average_cost_usd = ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
            [newBuyerTokenBal, newBuyerAvgCost, buy.user_id, tokenId]
          );

          const newSellerTokenBal = parseFloat((sellerTokenBalance  - fillQty).toFixed(8));
          const newSellerTokenRes = parseFloat(Math.max(0, sellerTokenReserved - fillQty).toFixed(8));
          await conn.execute(
            'UPDATE token_holdings SET balance = ?, reserved = ?, updated_at = NOW() WHERE user_id = ? AND token_id = ?',
            [newSellerTokenBal, newSellerTokenRes, sell.user_id, tokenId]
          );

          // 5. Update orders
          const newBuyFilled = Number(buy.filled_qty)  + fillQty;
          const buyStatus    = newBuyFilled >= Number(buy.quantity)  ? 'FILLED' : 'PARTIAL';
          await conn.execute(
            'UPDATE orders SET filled_qty = ?, status = ?, updated_at = NOW() WHERE id = ?',
            [newBuyFilled, buyStatus, buy.id]
          );

          const newSellFilled = Number(sell.filled_qty) + fillQty;
          const sellStatus    = newSellFilled >= Number(sell.quantity) ? 'FILLED' : 'PARTIAL';
          await conn.execute(
            'UPDATE orders SET filled_qty = ?, status = ?, updated_at = NOW() WHERE id = ?',
            [newSellFilled, sellStatus, sell.id]
          );

          // 6. Update token price
          await conn.execute(
            'UPDATE tokens SET current_price_usd = ? WHERE id = ?',
            [tradePrice, tokenId]
          );

          // F-03: settlement instruction for banking partner records
          await createSettlementInstruction(conn, {
            type:            'TRADE',
            token_symbol:    tokenSymbol,
            from_user_id:    buy.user_id,
            to_user_id:      sell.user_id,
            gross_amount:    totalValue,
            fee_amount:      totalFees + cgtAmount + imttAmount,
            net_amount:      sellerNet,
            settlement_rail: buyerRail,
            reference:       `TRADE-${buy.id.slice(0,8)}-${sell.id.slice(0,8)}-${Date.now()}`,
            metadata:        buyerRail !== sellerRail
              ? { cross_rail: true, buyer_rail: buyerRail, seller_rail: sellerRail }
              : null,
          });

          await conn.commit();

          // Update in-memory state for next iteration
          buy.filled_qty  = newBuyFilled;
          buy.status      = buyStatus;
          sell.filled_qty = newSellFilled;
          sell.status     = sellStatus;

          const tradeData = {
            id: `trade-${Date.now()}`, quantity: fillQty, price: tradePrice,
            totalValue, platformFee, seczLevy, vatOnPlatformFee, totalFees,
            imttAmount, cgtAmount, capitalGain, sellerNet,
            buyerRail, sellerRail,
            matchedAt: new Date().toISOString()
          };
          trades.push(tradeData);
          ws.emitTrade(tokenSymbol, tradeData);

          logger.info('Trade settled', {
            symbol: tokenSymbol, qty: fillQty, price: tradePrice,
            totalValue, platformFee, seczLevy, vatOnPlatformFee,
            imttAmount, cgtAmount, sellerNet, buyerRail, sellerRail,
            buyerTokenBal: newBuyerTokenBal, sellerTokenBal: newSellerTokenBal,
          });

        } catch (err) {
          await conn.rollback();
          logger.error('Settlement failed — rolled back', { error: err.message });
        } finally {
          conn.release();
        }

        if (buy.status === 'FILLED') break;
      }
    }

    if (trades.length > 0) {
      const orderBook = await getOrderBook(tokenId, db);
      ws.emitOrderBook(tokenSymbol, orderBook);
      ws.emitTicker(tokenSymbol, {
        symbol: tokenSymbol,
        price:  trades[trades.length - 1].price,
        trades: trades.length
      });
    }

    return trades;

  } catch (err) {
    logger.error('Matching engine error', { error: err.message, tokenId });
    throw err;
  }
}

async function getOrderBook(tokenId, db) {
  const [bids] = await db.execute(`
    SELECT limit_price as price, SUM(quantity - filled_qty) as quantity, COUNT(*) as orders
    FROM orders WHERE token_id = ? AND side = 'BUY'
    AND status IN ('OPEN','PARTIAL') AND limit_price IS NOT NULL
    GROUP BY limit_price ORDER BY limit_price DESC LIMIT 10
  `, [tokenId]);

  const [asks] = await db.execute(`
    SELECT limit_price as price, SUM(quantity - filled_qty) as quantity, COUNT(*) as orders
    FROM orders WHERE token_id = ? AND side = 'SELL'
    AND status IN ('OPEN','PARTIAL') AND limit_price IS NOT NULL
    GROUP BY limit_price ORDER BY limit_price ASC LIMIT 10
  `, [tokenId]);

  const spread = bids.length > 0 && asks.length > 0
    ? Number(asks[0].price) - Number(bids[0].price) : 0;

  return { bids, asks, spread: spread.toFixed(6) };
}

module.exports = { matchOrders, getOrderBook };
