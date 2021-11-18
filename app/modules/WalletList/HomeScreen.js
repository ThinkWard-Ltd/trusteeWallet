/**
 * @version 0.30
 */
import React from 'react'
import { 
    SafeAreaView, 
    View, 
    RefreshControl, 
    StyleSheet, 
    FlatList
} from 'react-native'
import { connect } from 'react-redux'

import { useScrollToTop } from '@react-navigation/native'

import _orderBy from 'lodash/orderBy'
import _isEqual from 'lodash/isEqual'

import CryptoCurrency from './elements/CryptoCurrency'
import WalletInfo from './elements/WalletInfo'
import Header from './elements/Header'

import Log from '@app/services/Log/Log'

import UpdateCurrencyRateDaemon from '@app/daemons/back/UpdateCurrencyRateDaemon'
import UpdateAccountListDaemon from '@app/daemons/view/UpdateAccountListDaemon'

import { ThemeContext } from '@app/theme/ThemeProvider'

import settingsActions from '@app/appstores/Stores/Settings/SettingsActions'
import { SendDeepLinking } from '@app/appstores/Stores/Send/SendDeepLinking'

import { setLoaderStatus } from '@app/appstores/Stores/Main/MainStoreActions'
import { getVisibleCurrencies } from '@app/appstores/Stores/Currency/selectors'
import { getIsBalanceVisible } from '@app/appstores/Stores/Settings/selectors'

import MarketingAnalytics from '@app/services/Marketing/MarketingAnalytics'
import AppLockBlur from '@app/components/AppLockBlur'

import { getIsBlurVisible, getSelectedWalletData, getSortValue } from '@app/appstores/Stores/Main/selectors'
import { getWalletsGeneralData } from '@app/appstores/Stores/Wallet/selectors'

import { NftActions } from '@app/appstores/Stores/Nfts/NftsActions'
import { getNftsData } from '@app/appstores/Stores/Nfts/selectors'
import { handleReceive, handleSend, handleHide, handleLateRefresh, getBalanceData, getSortedData } from './helpers'
import trusteeAsyncStorage from '@appV2/services/trusteeAsyncStorage/trusteeAsyncStorage'


class HomeScreen extends React.PureComponent {

    constructor(props) {
        super(props)
        this.state = {
            refreshing: false,
            isBalanceVisible: true,
            originalVisibility: false,
            isCurrentlyDraggable: false,
            hasStickyHeader: false,
            enableVerticalScroll: true,
            constructorMode: false,
            originalData: [],
            data: [],
            currenciesOrder: []
        }
        this.getCurrenciesOrder()
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        let newState = null

        if (!_isEqual(nextProps.currencies, prevState.originalData)) {
            newState = {}
            const currenciesOrder = prevState.currenciesOrder
            const currenciesLength = nextProps.currencies.length
            const data = _orderBy(nextProps.currencies, c => currenciesOrder.indexOf(c.currencyCode) !== -1 ? currenciesOrder.indexOf(c.currencyCode) : currenciesLength)
            newState.data = data
            newState.originalData = nextProps.currencies
            const newOrder = data.map(c => c.currencyCode)
            if (currenciesOrder.length && !_isEqual(currenciesOrder, newOrder)) {
                newState.currenciesOrder = newOrder
                trusteeAsyncStorage.setCurrenciesList(JSON.stringify(newOrder))
            }
        }

        return newState
    }

    getCurrenciesOrder = async () => {
        try {
            const res = await trusteeAsyncStorage.getCurrenciesList()
            const currenciesOrder = res !== null ? JSON.parse(res) : []
            const currenciesLength = this.state.data.length

            this.setState(state => ({
                currenciesOrder,
                data: _orderBy(state.data, c => currenciesOrder.indexOf(c.currencyCode) !== -1 ? currenciesOrder.indexOf(c.currencyCode) : currenciesLength)
            }))
        } catch (e) {
            Log.err(`HomeScreen getCurrenciesOrder error ${e.message}`)
        }
    }

    async componentDidMount() {
        try {
            Log.log('WalletList.HomeScreen initDeepLinking')
            SendDeepLinking.initDeepLinking()
        } catch (e) {
            Log.log('WalletList.HomeScreen initDeepLinking error ' + e.message)
        }
        setLoaderStatus(false)
        this.getBalanceVisibility()
        NftActions.init(false)
    }

    getBalanceVisibility = () => {
        const isBalanceVisible = this.props.isBalanceVisible
        this.setState(() => ({ isBalanceVisible, originalVisibility: isBalanceVisible }))
    }

    handleRefresh = async () => {
        try {
            this.setState({ refreshing: true })

            try {
                await UpdateCurrencyRateDaemon.updateCurrencyRate({ force: true, source: 'HomeScreen.handleRefresh' })
            } catch (e) {
                Log.errDaemon('WalletList.HomeScreen handleRefresh error updateCurrencyRateDaemon ' + e.message)
            }

            try {
                await UpdateAccountListDaemon.forceDaemonUpdate()
            } catch (e) {
                Log.errDaemon('WalletList.HomeScreen handleRefresh error updateAccountListDaemon ' + e.message)
            }

            try {
                await NftActions.getDataByAddress(this.props.nftsData.address, true)
            } catch (e) {
                Log.err('WalletList.HomeScreen handleRefresh error NftActions ' + e.message)
            }

            this.setState({ refreshing: false })
        } catch (e) {
            Log.err('WalletList.HomeScreen handleRefresh error ' + e.message)
        }

        handleLateRefresh()
    }

    changeBalanceVisibility = async () => {
        const newVisibilityValue = !this.state.isBalanceVisible
        settingsActions.setSettings('isBalanceVisible', newVisibilityValue ? '1' : '0')
        this.setState(() => ({ isBalanceVisible: newVisibilityValue, originalVisibility: newVisibilityValue }))
    }

    triggerBalanceVisibility = (value) => {
        this.setState((state) => ({ isBalanceVisible: value || state.originalVisibility }))
    }

    updateOffset = (offset) => {
        // const newOffset = Math.round(offset)
        const newOffset = Math.round(offset.nativeEvent.contentOffset.y)
        if (!this.state.hasStickyHeader && newOffset > 110) this.setState(() => ({ hasStickyHeader: true }))
        if (this.state.hasStickyHeader && newOffset < 110) this.setState(() => ({ hasStickyHeader: false }))
    }

    setScrollEnabled = (value) => {
        if (this.props.scrollRef && this.props.scrollRef.setNativeProps) {
            this.props.scrollRef.setNativeProps({ scrollEnabled: value });
        } else if (this.props.scrollRef && this.props.scrollRef.getScrollResponder) {
            const scrollResponder = this.props.scrollRef.getScrollResponder();
            if (scrollResponder.setNativeProps) scrollResponder.setNativeProps({ scrollEnabled: value });
        } else {
            this.setState(() => ({ enableVerticalScroll: value }))
        }
    };

    render() {
        if (this.props.isBlurVisible) {
            return <AppLockBlur />
        }
        const { colors } = this.context

        MarketingAnalytics.setCurrentScreen('WalletList.HomeScreen')

        const balanceData = getBalanceData(this.props)

        return (
            <View style={styles.container}>
                <Header
                    hasStickyHeader={this.state.hasStickyHeader}
                    isBalanceVisible={this.state.isBalanceVisible}
                    originalVisibility={this.state.originalVisibility}
                    triggerBalanceVisibility={this.triggerBalanceVisibility}
                    balanceData={balanceData}
                />
                <SafeAreaView style={[styles.safeAreaContent, { backgroundColor: colors.homeScreen.tabBarBackground }]} />
                    <View style={[styles.content, { backgroundColor: colors.common.background }]}>
                        <View style={styles.stub} />
                            <FlatList
                                ref={this.props.scrollRef}
                                data={getSortedData(this.state.originalData, this.state.data, this.props.sortValue)}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.list}
                                onScroll={this.updateOffset}
                                scrollEnabled={this.state.enableVerticalScroll}
                                refreshControl={
                                    <RefreshControl
                                        enabled={!this.state.constructorMode}
                                        refreshing={this.state.refreshing}
                                        onRefresh={this.handleRefresh}
                                        tintColor={colors.common.refreshControlIndicator}
                                        colors={[colors.common.refreshControlIndicator]}
                                        progressBackgroundColor={colors.common.refreshControlBg}
                                        progressViewOffset={-20}
                                    />
                                }
                                ListHeaderComponent={(
                                    <WalletInfo
                                        isBalanceVisible={this.state.isBalanceVisible}
                                        originalVisibility={this.state.originalVisibility}
                                        changeBalanceVisibility={this.changeBalanceVisibility}
                                        triggerBalanceVisibility={this.triggerBalanceVisibility}
                                        balanceData={balanceData}
                                        selectedWalletData={this.props.selectedWalletData}
                                    />
                                )}
                                renderItem={({ item, drag, isActive }) => (
                                    <CryptoCurrency
                                        cryptoCurrency={item}
                                        isBalanceVisible={this.state.isBalanceVisible}
                                        onDrag={drag}
                                        isActive={isActive}
                                        handleReceive={account => handleReceive(item, account)}
                                        handleSend={account => handleSend(item, account)}
                                        handleHide={() => handleHide(item)}
                                        setScrollEnabled={this.setScrollEnabled}
                                    />
                                )}
                                keyExtractor={item => item.currencyCode}
                            />
                    </View>
            </View>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        selectedWalletData: getSelectedWalletData(state),
        walletsGeneralData: getWalletsGeneralData(state),
        isBlurVisible: getIsBlurVisible(state),
        currencies: getVisibleCurrencies(state),
        isBalanceVisible: getIsBalanceVisible(state.settingsStore),
        nftsData: getNftsData(state),
        sortValue: getSortValue(state)
    }
}

HomeScreen.contextType = ThemeContext

function HomeWrap (props) {
    const ref = React.useRef(null);

    useScrollToTop(ref);

    return <HomeScreen {...props} scrollRef={ref} />
}

export default connect(mapStateToProps)(HomeWrap)


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeAreaContent: {
        flex: 0,
    },
    content: {
        flex: 1,
    },
    stub: {
        marginBottom: 50
    },
    list: {
        paddingBottom: 20,
        paddingTop: 10
    }
})
