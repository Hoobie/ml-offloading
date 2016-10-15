export function offloadable(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    let originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
        console.log('target: ', target);
        console.log('propertyKey: ', propertyKey);
        console.log('descriptor: ', descriptor);
        console.log('code: ', originalMethod.toString());
        console.log('args: ', JSON.stringify(args));

        let start = performance.now();

        let res = httpPost('http://localhost:8080', originalMethod.toString());

        // let result = originalMethod.apply(this, args);

        let end = performance.now();
        console.log('time [ms]: ', end - start);

        console.log('result: ' + res);
        return res;
    };

    return descriptor;
}

function httpPost(url, content) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, false);
    xhr.send(content);
    return xhr.responseText;
}
