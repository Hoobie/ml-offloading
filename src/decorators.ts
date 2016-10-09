function offloadable(target:Object, propertyKey:string, descriptor:PropertyDescriptor) {
    let originalMethod = descriptor.value;

    descriptor.value = function (...args:any[]) {
        console.log("target: ", target);
        console.log("propertyKey: ", propertyKey);
        console.log("descriptor: ", descriptor);
        console.log("code: ", originalMethod.toString());
        console.log("args: ", JSON.stringify(args));

        let start = performance.now();

        let result = originalMethod.apply(this, args);

        let end = performance.now();
        console.log("time [ms]: ", end - start);

        console.log("result: " + result);
        return result;
    };

    return descriptor;
}
