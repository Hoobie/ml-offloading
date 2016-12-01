const HEROKU_ENDPOINT = 'https://js-executor-service.herokuapp.com';
const DIGITAL_OCEAN_ENDPOINT = 'http://139.59.141.80';
const AMAZON_AWS_ENDPOINT = 'http://52.210.180.189';
const DOCKER_MACHINE_ENDPOINT = 'http://192.168.99.100:12346';

export default function offloadable(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    let originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
        console.log('code: ', originalMethod.toString());
        console.log('args: ', JSON.stringify(args).substring(0, 100));

        let start = performance.now();

        let body = {
          code: originalMethod.toString(),
          args: args
        };
        let jsonRes = httpPost(DOCKER_MACHINE_ENDPOINT, JSON.stringify(body));

        // let result = originalMethod.apply(this, args);

        let end = performance.now();
        console.log('time [ms]: ', end - start);

        console.log('result: ' + jsonRes);
        let res = JSON.parse(jsonRes);

        return res;
    };

    return descriptor;
}

function httpPost(url, content) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, false);
    xhr.send(content);
    return xhr.responseText;
}
