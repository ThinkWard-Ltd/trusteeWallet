/**
 * @version 0.41
 */
import analytics from '@react-native-firebase/analytics'

import NavStore from '@app/components/navigation/NavStore'
import { setSelectedCryptoCurrency, setSelectedAccount } from '@app/appstores/Stores/Main/MainStoreActions'
import store from '@app/store'
import Log from '@app/services/Log/Log'

import BlocksoftPrettyNumbers from '@crypto/common/BlocksoftPrettyNumbers'
import BlocksoftUtils from '@crypto/common/BlocksoftUtils'

import config from '@app/config/config'
import ApiRates from '@app/services/Api/ApiRates'
import MarketingEvent from '@app/services/Marketing/MarketingEvent'
import transactionActions from '@app/appstores/Actions/TransactionActions'


const logSendSell = async function(transaction: any, tx: any, logData: any, sendScreenStore: any) {
    const { bseMinCrypto, bseOrderId, bseTrusteeFee, bseOrderData } = sendScreenStore.ui

    if (typeof bseOrderId === 'undefined' || !bseOrderId) return
    transaction.bseOrderId = bseOrderId
    transaction.bseOrderIdOut = bseOrderId
    if (typeof bseOrderData !== 'undefined' && bseOrderData) {
        transaction.bseOrderData = bseOrderData
    }
    logData.bseOrderId = bseOrderId.toString()
    if (typeof bseMinCrypto !== 'undefined' && bseMinCrypto) {
        logData.bseMinCrypto = bseMinCrypto.toString()
    }

    // https://rnfirebase.io/reference/analytics#logPurchase
    let usdValue = bseTrusteeFee.value
    let localCurrency = bseTrusteeFee.currencyCode.toLowerCase()
    let usdCurrency = 'usd'
    Log.log('sendScreenData.bseTrusteeFee in ' + localCurrency + ' ' + usdValue, bseTrusteeFee)
    if (usdValue * 1 > 0) {
        if (localCurrency !== 'usd') {
            const rate = ApiRates.getRatesWithLocal()
            if (localCurrency.indexOf('usdt') !== -1) {
                usdValue = typeof rate.usdttousd !== 'undefined' && rate.usdttousd > 0 ? BlocksoftUtils.mul(rate.usdttousd, usdValue) : usdValue
                Log.log('sendScreenData.bseTrusteeFee rate1 ' + rate.usdttousd + ' => ' + usdValue)
            } else if (typeof rate['usdto' + localCurrency] !== 'undefined') {
                usdValue = BlocksoftUtils.div(usdValue, rate['usdto' + localCurrency])
                Log.log('sendScreenData.bseTrusteeFee rate2 ' + rate['usdto' + localCurrency] + ' => ' + usdValue)
            } else if (typeof rate[localCurrency] !== 'undefined') {
                usdValue = BlocksoftUtils.div(usdValue, rate[localCurrency])
                Log.log('sendScreenData.bseTrusteeFee rate3 ' + rate[localCurrency] + ' => ' + usdValue)
            } else {
                Log.log('sendScreenData.bseTrusteeFee rate4 not found ' + localCurrency)
                usdCurrency = 'uah'
            }
        } else {
            usdValue = bseTrusteeFee.value
        }
    }
    let gaParams = {}
    try {
        gaParams = {
            transaction_id: bseOrderId,
            value: usdValue * 1,
            currency: usdCurrency,
            items: [{
                item_brand: bseTrusteeFee.type,
                item_category: bseTrusteeFee.from,
                item_category2: bseTrusteeFee.to,
                item_id: bseOrderId,
                item_name: bseTrusteeFee.from + '_' + bseTrusteeFee.to,
                quantity: BlocksoftPrettyNumbers.setCurrencyCode(transaction.currencyCode).makePretty(transaction.addressAmount)
            }]
        }

        await MarketingEvent.logEvent('v20_sell_tx', gaParams, 'SELL')
        await Log.log('v20_sell_tx', gaParams)
        await analytics().logPurchase(gaParams)
    } catch (e) {
        if (config.debug.appErrors) {
            console.log('v20_sell_tx error ' + e.message, gaParams)
        }
        await Log.err('v20_sell_tx error ' + e.message)
    }
}

export namespace SendActionsEnd {

    export const endRedirect = async (tx: any, sendScreenStore: any) => {
        const { currencyCode } = sendScreenStore.dict
        const { uiType } = sendScreenStore.ui
        if (uiType === 'MAIN_SCANNER') {
            NavStore.reset('DashboardStack')
        } else if (uiType === 'SEND_SCANNER' || uiType === 'ACCOUNT_SCREEN') {
            // NavStore.reset('AccountScreen')
            NavStore.goNext('TransactionScreen', {
                txData: {
                    transactionHash: tx.transactionHash
                }
            })
        } else if (uiType === 'TRADE_SEND') {
            NavStore.reset('TransactionScreen', {
                txData: {
                    transactionHash: tx.transactionHash
                }
            })
        } else if (uiType === 'DEEP_LINKING' || uiType === 'HOME_SCREEN') {
            // account was not opened before
            const { cryptoCurrencies } = store.getState().currencyStore
            let cryptoCurrency = { currencyCode: false }
            // @ts-ignore
            for (const tmp of cryptoCurrencies) {
                if (tmp.currencyCode === currencyCode) {
                    cryptoCurrency = tmp
                }
            }
            if (cryptoCurrency.currencyCode) {
                setSelectedCryptoCurrency(cryptoCurrency)
                await setSelectedAccount()
                NavStore.reset('AccountScreen')
            }
            NavStore.reset('DashboardStack')
        } else {
            // fio request etc - direct to receipt
            NavStore.goBack(null)
        }

    }

    export const saveTx = async (tx: any, sendScreenStore: any) => {
        const { currencyCode, accountId, walletHash, addressFrom } = sendScreenStore.dict
        const { addressTo, cryptoValue, memo, comment, bseMinCrypto } = sendScreenStore.ui
        const { selectedFee } = sendScreenStore.fromBlockchain

        const now = new Date().toISOString()

        let transactionJson = {}
        if (memo) {
            transactionJson.memo = memo
        }
        if (comment) {
            transactionJson.comment = comment
        }
        if (bseMinCrypto) {
            transactionJson.bseMinCrypto = bseMinCrypto
        }
        if (typeof tx.transactionJson !== 'undefined') {
            let key
            for (key in tx.transactionJson) {
                transactionJson[key] = tx.transactionJson[key]
            }
        }


        const transaction = {
            currencyCode: currencyCode,
            accountId: accountId,
            walletHash: walletHash,
            transactionHash: tx.transactionHash,
            transactionStatus: 'new',
            addressTo: addressTo,
            addressToBasic: addressTo,
            addressFrom: '',
            addressFromBasic: addressFrom,
            addressAmount: typeof tx.amountForTx !== 'undefined' ? tx.amountForTx : cryptoValue,
            transactionFee: tx.transactionFee || '',
            transactionFeeCurrencyCode: tx.transactionFeeCurrencyCode || '',
            transactionOfTrusteeWallet: 1,
            transactionJson,
            blockConfirmations: 0,
            createdAt: now,
            updatedAt: now,
            transactionDirection: addressTo === addressFrom ? 'self' : 'outcome',
            transactionsScanLog: now + ' CREATED '
        }
        if (typeof tx.amountForTx !== 'undefined') {
            transaction.addressAmount = tx.amountForTx
        }
        if (typeof tx.blockHash !== 'undefined') {
            transaction.blockHash = tx.blockHash
        }
        if (typeof tx.transactionStatus !== 'undefined') {
            transaction.transactionStatus = tx.transactionStatus
        }
        if (transaction.addressTo === addressFrom) {
            transaction.addressTo = ''
            transaction.transactionDirection = 'self'
        }
        if (typeof tx.transactionTimestamp !== 'undefined' && tx.transactionTimestamp) {
            transaction.createdAt = new Date(tx.transactionTimestamp).toISOString()
            transaction.updatedAt = new Date(tx.transactionTimestamp).toISOString()
        }

        const logData = {
            walletHash: walletHash,
            currencyCode: currencyCode,
            transactionHash: tx.transactionHash,
            addressTo: addressTo,
            addressFrom: addressFrom,
            addressAmount: cryptoValue,
            fee: JSON.stringify(selectedFee)
        }

        await logSendSell(transaction, tx, logData, sendScreenStore)

        const line = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')

        if (config.debug.sendLogs) {
            console.log('SendActionsEnd.saveTx new', transaction)
        }

        // @ts-ignore
        await transactionActions.saveTransaction(transaction, line + ' HANDLE SEND ')
    }

}
