/// <reference path="./declarations.d.ts" />

import { Configuration } from "./configuration";
import { Classifiers } from "./classifiers/classifiers";
import * as Rx from "rxjs";

const W_T = 0.3;
const W_E = 0.7;

let isCordovaApp = !!(window as MyWindow).cordova;
let wifiEnabled = true;

let reasearchData = [];

export function offloadable(withCallback: boolean) {
  return function(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    if (descriptor === undefined) {
      descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
    }

    let originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
      if (isCordovaApp) {
        (window as MyWindow).startPowerMeasurements(function(msg) {
          if (msg) {
            console.log(msg);
          }
        });
      }

      if (typeof WifiWizard !== "undefined") {
        WifiWizard.isWifiEnabled(function(enabled: boolean) {
          wifiEnabled = enabled;
          console.log("WiFi enabled: " + wifiEnabled);
        }, function(err) { });
      }

      let strMethod = originalMethod.toString();
      let jsonArgs = JSON.stringify(args);
      let observable: Rx.Observable<any>;
      let start = performance.now();
      let local_cost, offload_pc_cost, offload_cloud_cost;
      let date = new Date();
      let online = navigator.onLine;
      let predict = Configuration.execution === Configuration.ExecutionType.PREDICTION;
      let features = [0, hashCodeNormalized(strMethod),
        jsonArgs.length * 2 / 1024 / 100, date.getHours() / 24,
        wifiEnabled ? 1 : 0];

      console.log("code: ", strMethod.substring(0, 150), "...");
      console.log("args: ", args);
      console.log("online: ", online);

      if (Configuration.execution === Configuration.ExecutionType.PREDICTION) {
        local_cost = cost(Classifiers.getTimeClassifier().predict(features),
          Classifiers.getEnergyClassifier().predict(features));
        features[0] = (Configuration.ExecutionType.PC_OFFLOADING - 1) * Configuration.EXECUTION_MULTIPLIER;
        offload_pc_cost = cost(Classifiers.getTimeClassifier().predict(features),
          Classifiers.getEnergyClassifier().predict(features));
        features[0] = (Configuration.ExecutionType.CLOUD_OFFLOADING - 1) * Configuration.EXECUTION_MULTIPLIER;
        offload_cloud_cost = cost(Classifiers.getTimeClassifier().predict(features),
          Classifiers.getEnergyClassifier().predict(features));

        console.log("local cost: ", local_cost);
        console.log("PC offload cost: ", offload_pc_cost);
        console.log("Cloud offload cost: ", offload_cloud_cost);
      }

      let execution = Configuration.ExecutionType.LOCAL;
      if (Configuration.execution === Configuration.ExecutionType.LOCAL
        || local_cost <= offload_pc_cost && local_cost <= offload_cloud_cost) {

        console.log("execution: LOCAL");
        if (withCallback) {
          observable = Rx.Observable.create(function(observer) {
            originalMethod.apply(this, args);
          }).observeOn(Rx.Scheduler.asap).subscribeOn(Rx.Scheduler.asap);
        } else {
          observable = Rx.Observable.create(function(observer) {
            let result = originalMethod.apply(this, args);
            observer.next(result);
            observer.complete();
          }).observeOn(Rx.Scheduler.asap).subscribeOn(Rx.Scheduler.asap);
        }
      } else {
        execution = Configuration.execution === Configuration.ExecutionType.PREDICTION ?
          (offload_pc_cost <= offload_cloud_cost ? Configuration.ExecutionType.PC_OFFLOADING : Configuration.ExecutionType.CLOUD_OFFLOADING)
          : Configuration.execution;

        console.log("execution: " + Configuration.ExecutionType[execution]);
        const id = Date.now();
        let body = {
          id: id,
          code: strMethod,
          args: args,
          withCallback: withCallback
        };
        observable = Rx.Observable.create(function(observer) {
          let localWebdisEndpoint = "http://" + Configuration.localEndpoint + ":7379";
          let remoteWebdisEndpoint = "http://" + Configuration.remoteEndpoint + ":7379";
          let url = execution === Configuration.ExecutionType.PC_OFFLOADING ? localWebdisEndpoint : remoteWebdisEndpoint;
          offloadMethod(observer, url, JSON.stringify(body), id.toString());
        }).observeOn(Rx.Scheduler.asap).subscribeOn(Rx.Scheduler.asap);
      }

      let subject = new Rx.ReplaySubject(1);
      subject.subscribe(
        function(x) { },
        function(e) { },
        function() {
          let time = performance.now() - start;
          console.log("time [ms]: ", time);
          let executionTime = time < 500 ? -2 : (time < 1000 ? -1 :
            (time < 2000 ? 0 : (time < 5000 ? 1 : 2)));

          features[0] = (execution - 1) * Configuration.EXECUTION_MULTIPLIER;
          console.log("features: ", JSON.stringify(features));

          let energyDrain = -2;
          let batteryTotal = 0;
          if (isCordovaApp) {
            (window as MyWindow).stopPowerMeasurements(function(battery) {
              console.log(JSON.stringify(battery));
              batteryTotal = battery.total;
              energyDrain = battery.total < 0.025 ? -2 :
                (battery.total < 0.05 ? -1 :
                  (battery.total < 0.1 ? 0 :
                    (battery.total < 0.25 ? 1 : 2)));

              console.log("learn energy: ", energyDrain);
              if (Configuration.shouldTrain && Configuration.shouldTrainAllClassifiers) {
                Classifiers.trainAllEnergy(features, energyDrain);
              } else if (Configuration.shouldTrain) {
                Classifiers.getEnergyClassifier().train(features, energyDrain);
              }

              reasearchData.push([Configuration.roundId,
                predict ? Configuration.ClassifierType[Configuration.classifier] : "NONE",
                predict ? "PREDICTION" : "FIXED",
                Configuration.ExecutionType[execution],
                wifiEnabled ? 1 : 0,
                time, batteryTotal]);
              console.log("data: ", JSON.stringify(reasearchData));
            });
          }

          console.log("learn time: ", executionTime);
          if (Configuration.shouldTrain && Configuration.shouldTrainAllClassifiers) {
            Classifiers.trainAllTime(features, executionTime);
            if (!isCordovaApp) Classifiers.trainAllEnergy(features, executionTime);
          } else if (Configuration.shouldTrain) {
            Classifiers.getTimeClassifier().train(features, executionTime);
            if (!isCordovaApp) Classifiers.getEnergyClassifier().train(features, executionTime);
          }
        }
      );
      observable
        .catch(e => {
          console.error(e);
          return Rx.Observable.of(e);
        })
        .subscribe(subject);

      return subject;
    };

    return descriptor;
  };
}

function cost(mT: number, mE: number): number {
  return (W_T * mT) + (W_E * mE);
}

function hashCodeNormalized(s: string): number {
  let hash = 0, chr;
  if (s.length === 0) return hash;
  for (let i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  if (hash > 0) return parseFloat("0." + hash);
  else return parseFloat("-0." + Math.abs(hash));
};

function offloadMethod(observer: Rx.Observer<any>, webdisUrl: string, msgBody: string, id: string) {
  msgBody = msgBody.replace(/\\n/g, "").replace(/\./g, "%2e"); // .replace(/\//g, "%2f");
  let onLoadCallback = function(e) {
    if (this.readyState === 4) {
      if (this.status === 200) {
        let result = JSON.parse(this.responseText);
        if (!result.BLPOP) {
          http(observer, "GET", webdisUrl + "/BLPOP/" + id + "/600", null, onLoadCallback);
        } else {
          console.debug("Parsed HTTP result: ", result);
          observer.next(result.BLPOP[1]);
          observer.complete();
        }
      } else {
        observer.error(this.statusText);
      }
    }
  };
  http(observer, "POST", webdisUrl + "/", "RPUSH/requests/" + encodeURIComponent(msgBody), onLoadCallback);
}

function http(observer: Rx.Observer<any>, method: string, url: string, params: string, onLoadCallback: (e) => void) {
  let xhr = new XMLHttpRequest();
  xhr.onerror = function(e) {
    observer.error(e);
  };
  xhr.open(method, url, true);
  xhr.setRequestHeader("Content-type", "application/json");
  xhr.onload = onLoadCallback;
  xhr.send(params);
}
