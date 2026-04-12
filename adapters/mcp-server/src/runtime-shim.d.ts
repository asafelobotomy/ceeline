declare const process: {
  stdin: {
    setEncoding(encoding: string): void;
    on(event: "data", listener: (chunk: string) => void): void;
    resume(): void;
  };
  stdout: {
    write(chunk: string): void;
  };
};