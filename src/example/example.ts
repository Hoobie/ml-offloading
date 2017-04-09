import { offloadable } from '../decorators';
import { Configuration } from '../configuration';
import * as Rx from 'rxjs';

class Example {
    @offloadable(false)
    test1(): any {
        return "test1";
    }

    @offloadable(false)
    test2(arg: string): any {
        return "test2";
    }
}

let example = new Example();

let t1: Rx.Subject<any> = example.test1();
t1.subscribe(
    function(x) { console.log('onNext: ', x); },
    function(e) { console.log('onError: ', JSON.stringify(e)); },
    function() {
        console.log('onCompleted');

        Configuration.execution = Configuration.ExecutionType.PC_OFFLOADING;

        let arg = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas lacinia placerat nulla ut aliquet. Cras feugiat est quis dolor mattis feugiat. Suspendisse pretium nisi ipsum, nec iaculis risus ultrices vel. Aenean ac egestas risus. Nulla convallis faucibus arcu sed tincidunt. Donec semper pharetra finibus. In dapibus mauris ut erat posuere faucibus. Mauris eget nibh ante. Fusce tempus mi erat, non luctus mauris congue in. Fusce consequat felis est, id semper libero fringilla eu. Nulla ultricies mauris dui, id convallis est faucibus eget. Suspendisse placerat enim id mi venenatis, sit amet ornare odio euismod. Maecenas luctus, risus quis ultrices lobortis, enim dui fermentum ex, eget aliquam felis eros in orci. Etiam dignissim tortor ut pretium aliquam. Pellentesque cursus efficitur metus, ut ullamcorper ante pharetra id. Quisque aliquet, augue vitae pretium laoreet, tellus justo fringilla sapien, congue cursus arcu urna vitae nunc. Suspendisse maximus porttitor nisi id interdum. Fusce odio lectus, faucibus et congue dictum, interdum ultricies risus. Cras vitae leo mi. Quisque ante nisi, ullamcorper a scelerisque eu, euismod et ante. Fusce non nibh quis lacus iaculis convallis. Nullam lacinia tincidunt urna, sed lobortis mauris vulputate feugiat. Donec vitae suscipit massa. Proin ac magna tortor. Proin sed auctor risus, eget rhoncus sapien. Phasellus turpis elit, luctus eget mauris quis, viverra gravida dolor. Phasellus faucibus magna quis dolor condimentum fringilla. Nulla eget risus ut ligula efficitur tincidunt at vel purus. Mauris in urna at ante pretium commodo. Praesent hendrerit tortor ut pulvinar convallis. Vivamus quis malesuada eros. In vulputate purus sit amet tellus tempor sodales. In sed volutpat felis, at rutrum neque. Nunc sit amet aliquet nisi. In egestas sem nec varius ornare. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.";
        let t2: Rx.Subject<any> = example.test2(arg);
        t2.subscribe(
            function(x) { console.log('onNext: ', x); },
            function(e) { console.log('onError: ', JSON.stringify(e)); },
            function() { console.log('onCompleted'); }
        );
    }
);
