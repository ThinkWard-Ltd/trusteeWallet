/**
 * @version 0.43
 * @author Vadym
 */
import React, { PureComponent } from 'react'
import { Image, ScrollView, Text, View, Platform } from 'react-native'

import { connect } from 'react-redux'
import { TabView } from 'react-native-tab-view'

import ListItem from '@app/components/elements/new/list/ListItem/Setting'
import NavStore from '@app/components/navigation/NavStore'
import MarketingAnalytics from '@app/services/Marketing/MarketingAnalytics'

import BlocksoftPrettyStrings from '@crypto/common/BlocksoftPrettyStrings'

import { strings } from '@app/services/i18n'

import ScreenWrapper from '@app/components/elements/ScreenWrapper'
import { checkQRPermission } from '@app/services/UI/Qr/QrPermissions'

import LinkInput from '@app/components/elements/NewInput'
import UpdateAccountListDaemon from '@app/daemons/view/UpdateAccountListDaemon'
import UpdateOneByOneDaemon from '@app/daemons/back/UpdateOneByOneDaemon'
import { ThemeContext } from '@app/theme/ThemeProvider'

import { getWalletConnectData } from '@app/appstores/Stores/WalletConnect/selectors'

import InfoNotification from '@app/components/elements/new/InfoNotification'
import Button from '@app/components/elements/new/buttons/Button'
import Tabs from '@app/components/elements/new/cashbackTabs'
import Message from '@app/components/elements/new/Message'
import CustomIcon from '@app/components/elements/CustomIcon'
import GradientView from '@app/components/elements/GradientView'

import TransactionItem from '@app/modules/Account/AccountTransaction/elements/TransactionItem'
import WalletDappFastLinksScreen from '@app/modules/WalletDapp/WalletDappFastLinksScreen'

import colorDict from '@app/services/UIDict/UIDictData'

import { NETWORKS_SETTINGS } from '@app/appstores/Stores/WalletConnect/settings'
import { getSelectedAccountData } from '@app/appstores/Stores/Main/selectors'
import { getWalletDappData } from '@app/appstores/Stores/WalletDapp/selectors'
import walletConnectActions from '@app/appstores/Stores/WalletConnect/WalletConnectStoreActions'
import { QRCodeScannerFlowTypes, setQRConfig } from '@app/appstores/Stores/QRCodeScanner/QRCodeScannerActions'
import Toast from 'react-native-root-toast'
import Log from '@app/services/Log/Log'


const getIcon = (block, isLight) => {
    let _block = block
    if (block === 'MATIC') {
        _block = 'ETH_MATIC'
    } else if (block === 'ONE') {
        _block = 'ETH_ONE'
    }

    return (
        <CustomIcon name={_block} style={{ color: colorDict[block].colors[isLight ? 'mainColor' : 'darkColor'] }} size={14} />
    )
}

class WalletConnectScreen extends PureComponent {


    state = {
        inputFullLink : '',
        routes: [
            {
                title: 'wc',
                key: 'first'
            },
            {
                title: 'dapps',
                key: 'second'
            }
        ],
        index: 0
    }

    linkInput = React.createRef()

    handleChangeFullLink = (value) => {
        this.setState({
            inputFullLink: value.trim()
        })
    }

    handleConnect = () => {
        if (walletConnectActions.connectAndSetWalletConnectLink(this.state.inputFullLink, 'WalletConnectScreen')) {
            // connected so we can clear input
            this.linkInput.handleInput('', false)
            this.setState({
                inputFullLink: ''
            })
        }
    }

    handleDisconnect = async () => {
        return walletConnectActions.disconnectAndSetWalletConnectLink()
    }

    qrPermissionCallback = () => {
        Log.log('Settings qrPermissionCallback started')
        setQRConfig({
            flowType: QRCodeScannerFlowTypes.WALLET_CONNECT_SCANNER, callback: async (data) => {
                try {
                    await walletConnectActions.connectAndSetWalletConnectLink(data.fullLink, 'WalletConnectScreen')
                } catch (e) {
                    Log.log('QRCodeScannerScreen callback error ' + e.message)
                    Toast.setMessage(e.message).show()
                }
            }
        })
        NavStore.goNext('QRCodeScannerScreen')
    }

    handleBack = async () => {
        NavStore.goBack()
    }

    handleClose = async () => {
        NavStore.reset('HomeScreen')
    }

    handleChangeNetwork = () => {
        NavStore.goNext('WalletConnectChangeNetworkScreen')
    }

    handleLastDapp = () => {
        NavStore.goNext('WalletDappWebViewScreen')
    }

    getNetwork = (currencyCode) => {
        for (const tmp of NETWORKS_SETTINGS) {
            if (tmp.currencyCode === currencyCode) {
                return tmp.networkTitle
            }
        }
        return currencyCode
    }

    handleTabChange = index => {
        this.setState({ index })
    }

    renderTabs = () => <Tabs active={this.state.index} tabs={this.state.routes} changeTab={this.handleTabChange} />

    renderScene = ({ route }) => {
        switch (route.key) {
            case 'first':
                return this.renderFirstRoute()
            case 'second':
                return this.renderSecondRoute()
            default:
                return null
        }
    }

    renderFirstRoute = () => {

        const {
            GRID_SIZE,
            colors,
            isLight
        } = this.context

        const { dappCode, dappName } = this.props.walletDappData

        const { walletConnectLink, walletConnectLinkError, accountCurrencyCode, accountAddress, accountWalletName, peerId, peerMeta, isConnected } = this.props.walletConnectData

        const condition = peerId && typeof peerMeta !== 'undefined' && isConnected

        const titleCondition = condition ? typeof peerMeta.name !== 'undefined' ? peerMeta.name : '' : strings('settings.walletConnect.unconnectedTitle')

        const textCondition = condition ? typeof peerMeta.url !== 'undefined' ? peerMeta.url : '' : strings('settings.walletConnect.unconnectedText')

        const imageUri = peerMeta?.icons?.length ? peerMeta?.icons?.find(item => item.indexOf('.png') !== -1) : ''

        return (
            <>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollViewContent, { paddingBottom: GRID_SIZE * 4.5 }]}
                    keyboardShouldPersistTaps='handled'
                >
                    <View style={{ marginTop: GRID_SIZE }}>
                        <View style={{ overflow: 'hidden' }}>

                                <>
                                    <View style={[styles.imageView, { marginTop: GRID_SIZE * 1.5, paddingHorizontal: GRID_SIZE, backgroundColor: colors.common.roundButtonContent }]}>
                                        {peerId && peerMeta && isConnected ?
                                            <Image style={styles.image} resizeMode='cover' source={{
                                                uri: imageUri
                                            }} /> : <CustomIcon name='walletConnect' color='#555555' size={40} style={styles.walletConnectLogo} />
                                        }
                                        {peerId && peerMeta && isConnected &&
                                            <View style={[styles.icon__mark, { backgroundColor: colors.common.iconMarkBg }]}>
                                                {getIcon(accountCurrencyCode, isLight)}
                                            </View>
                                        }
                                    </View>
                                    <View style={{ marginVertical: GRID_SIZE * 1.5, paddingHorizontal: GRID_SIZE }}>
                                        <View style={{ alignSelf: 'center', justifyContent: 'center' }}>
                                            <Text style={[styles.peerMetaName, { color: colors.common.text1 }]}>{titleCondition}</Text>
                                            <Text style={styles.peerMetaUrl}>{textCondition}</Text>
                                        </View>
                                    </View>
                                    {peerId && peerMeta !== 'undefined' && isConnected &&
                                        <View style={{ paddingHorizontal: GRID_SIZE, marginTop: -GRID_SIZE / 2 }}>
                                            <TransactionItem
                                                title={accountWalletName}
                                                subtitle={BlocksoftPrettyStrings.makeCut(accountAddress, 8)}
                                                iconType='wallet'
                                            />
                                        </View>
                                    }
                                </>


                            {!isConnected &&
                                <>
                                    <View style={{ ...styles.linkInput, margin: GRID_SIZE }}>
                                        <LinkInput
                                            ref={component => this.linkInput = component}
                                            id='WALLET_CONNECT_LINK'
                                            name={strings('settings.walletConnect.inputPlaceholder')}
                                            type='WALLET_CONNECT_LINK'
                                            paste={true}
                                            copy={false}
                                            qr={true}
                                            placeholder='wc:e82c6b46-360c-4ea5-9825-9556666454afe@1?bridge=https%3'
                                            onChangeText={this.handleChangeFullLink}
                                            callback={this.handleChangeFullLink}
                                            pasteCallback={this.handleChangeFullLink}
                                            addressError={walletConnectLinkError && this.state.inputFullLink === walletConnectLink}
                                            qrCallback={() => checkQRPermission(this.qrPermissionCallback)}
                                            validPlaceholder={true}
                                            containerStyle={{ height: 50 }}
                                            inputStyle={{ marginTop: -5 }}
                                        />
                                    </View>
                                    {walletConnectLinkError && this.state.inputFullLink === walletConnectLink &&
                                        <Message
                                            name='warningM'
                                            timer={false}
                                            text={strings('settings.walletConnect.linkError')}
                                            containerStyles={{ marginTop: 12, marginHorizontal: GRID_SIZE }}
                                        />
                                    }

                                </>
                            }
                        </View>
                        {accountCurrencyCode && isConnected &&
                            <View style={{ marginTop: GRID_SIZE / 2, marginHorizontal: GRID_SIZE }}>
                                <ListItem
                                    title={strings('settings.walletConnect.changeNetwork')}
                                    subtitle={this.getNetwork(accountCurrencyCode)}
                                    iconType='blockchain'
                                    onPress={this.handleChangeNetwork}
                                    rightContent='arrow'
                                    last
                                />
                            </View>
                        }
                        {dappCode && isConnected &&
                            <View style={{ marginHorizontal: GRID_SIZE }}>
                                <ListItem
                                    title={strings('settings.walletConnect.returnDapp')}
                                    subtitle={dappName}
                                    iconType='scanning'
                                    onPress={this.handleLastDapp}
                                    rightContent='arrow'
                                    last
                                />
                            </View>
                        }


                        {isConnected &&
                            <View style={{ paddingHorizontal: GRID_SIZE }}>
                                <InfoNotification
                                    title={strings('settings.walletConnect.notificationTitle')}
                                    subTitle={strings('settings.walletConnect.notificationText', { name: peerMeta?.name || 'UNKNOWN'})}
                                    iconType='warningMessage'
                                />
                            </View>
                        }
                    </View>
                </ScrollView>
                <View style={[styles.mainButton, { bottom: GRID_SIZE, paddingHorizontal: GRID_SIZE }]}>
                    <Button
                        onPress={isConnected ? this.handleDisconnect : this.handleConnect}
                        title={isConnected ? strings('settings.walletConnect.disconnect') : strings('settings.walletConnect.connect')}
                    />
                </View>
                <GradientView
                    style={styles.bottomButtons}
                    array={colors.accountScreen.bottomGradient}
                    start={styles.containerBG.start}
                    end={styles.containerBG.end}
                />
            </>
        )
    }

    renderSecondRoute = () => {

        const {
            colors
        } = this.context

        return (
            <>
                <WalletDappFastLinksScreen />
                <GradientView
                    style={styles.bottomButtons}
                    array={colors.accountScreen.bottomGradient}
                    start={styles.containerBG.start}
                    end={styles.containerBG.end}
                />
            </>
        )
    }

    render() {

        MarketingAnalytics.setCurrentScreen('WalletConnect')
        UpdateAccountListDaemon.pause()
        UpdateOneByOneDaemon.pause()

        return (
            <ScreenWrapper
                leftType='back'
                leftAction={this.handleBack}
                rightType='close'
                rightAction={this.handleClose}
                title={strings('settings.walletConnect.title')}
                ExtraView={this.renderTabs}
            >
                <TabView
                    renderScene={this.renderScene}
                    onIndexChange={this.handleTabChange}
                    navigationState={this.state}
                    renderTabBar={() => null}
                    renderHeader={null}
                    useNativeDriver
                />
            </ScreenWrapper>
        )
    }
}


const mapStateToProps = (state) => {
    return {
        selectedAccountData: getSelectedAccountData(state),
        walletConnectData: getWalletConnectData(state),
        walletDappData: getWalletDappData(state)
    }
}

WalletConnectScreen.contextType = ThemeContext

export default connect(mapStateToProps)(WalletConnectScreen)

const styles = {
    scrollViewContent: {
        flexGrow: 1
    },
    buttonHeader: {
        borderRadius: 10,
        borderWidth: 2,
        height: 40,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
    },
    noButtonHeader: {
        height: 40,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
    },
    linkInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,

        elevation: 5
    },
    placeholder: {
        width: '100%',
        fontFamily: 'SFUIDisplay-Regular',
        fontSize: 14,
        lineHeight: 18,
        letterSpacing: 1,
        textAlign: 'center',
        color: '#999999'
    },
    imageView: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,

        elevation: 2,

        width: 60,
        height: 60,
        borderRadius: 30,
        alignSelf: 'center',
        justifyContent: 'center'
    },
    peerMetaName: {
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 17,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 3
    },
    peerMetaUrl: {
        fontFamily: 'SFUIDisplay-Regular',
        fontSize: 14,
        lineHeight: 18,
        letterSpacing: 1,
        textAlign: 'center',
        color: '#999999'
    },
    image: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignSelf: 'center',
        justifyContent: 'center'
    },
    networkText: {
        textAlign: 'center',
        color: '#999999',
        fontFamily: 'Montserrat-Bold',
        fontSize: 11,
        lineHeight: 14,
        textTransform: 'uppercase',
        letterSpacing: 1.5
    },
    network: {
        position: 'absolute',
        alignSelf: 'flex-end',
        width: 104,
        height: 30,
        backgroundColor: '#99999926',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#999999'
    },
    mainButton: {
        position: 'absolute',
        zIndex: 2,
        width: '100%'
    },
    walletConnectLogo: {
        alignSelf: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40
    },
    bottomButtons: {
        position: 'absolute',
        bottom: 0,
        left: 0,

        width: '100%',
        height: 66,
        paddingBottom: Platform.OS === 'ios' ? 30 : 0
    },
    containerBG: {
        start: { x: 1, y: 0 },
        end: { x: 1, y: 1 }
    },
    icon__mark: {
        justifyContent: 'center',
        alignItems: 'center',

        position: 'absolute',
        top: 44,
        right: -2,
        width: 20,
        height: 20,

        borderWidth: 0,

        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,

        elevation: 2
    }
}
