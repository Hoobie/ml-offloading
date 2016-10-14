class Example {
    @offloadable
    test(): string {
        return "test";
    }
}

let example = new Example();
example.test();
