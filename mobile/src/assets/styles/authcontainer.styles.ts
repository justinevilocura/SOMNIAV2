import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    background: {
        width: '100%',
        height: '100%',
    },
    container: {
        flex: 1,
        margin: 20,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0px 0px 150px rgb(1, 1, 1)',
    },
    authTypeImg: {
        height: 50,
        width: 100,
        marginBottom: 5,
    },
    backgroundLogo: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    absoluteFill: { ...StyleSheet.absoluteFillObject },
    authContents: {
        flex: 1,
        justifyContent: 'flex-start',
        padding: 20,
    },
    appNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        marginTop: 20,
    },
    appName: { height: 60 },
    button: {
        backgroundColor: '#5d3fd3',
        borderRadius: 25,
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
        marginTop: 10,
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: "600",
    },
    bottomLine: {
        height: 1,
        backgroundColor: '#ccc', // or any color you like
        width: '100%',
        bottom: 0,
        left: 0,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 10,
    },
    footerText: {
        marginRight: 5,
        fontSize: 16,
        color: '#ffffff',
    },
    link: {
        fontWeight: "600",
        fontSize: 16,
        color: '#ffffff',
    },
});

export default styles;