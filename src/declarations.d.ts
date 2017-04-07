declare module 'knear';
declare module 'ml-cart';

interface MyWindow extends Window {
    cordova;
    ActiveXObject;

    Mind();
    startPowerMeasurements(fun: (data) => any): any;
    stopPowerMeasurements(fun: (data) => any): any;
}

declare namespace WifiWizard {
    function isWifiEnabled(win: (enabled: boolean) => void, fail: (err) => void);
}
