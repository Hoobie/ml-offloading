declare module 'knear';
declare module 'ml-cart';
declare module 'ml-fnn'

interface MyWindow extends Window {
    cordova;
    ActiveXObject;

    startPowerMeasurements(fun: (data) => any): any;
    stopPowerMeasurements(fun: (data) => any): any;
}

declare namespace WifiWizard {
    function isWifiEnabled(win: (enabled: boolean) => void, fail: (err) => void);
}
