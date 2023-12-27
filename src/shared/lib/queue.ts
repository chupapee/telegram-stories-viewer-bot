export class Queue<T> {
  private static instance: Queue<unknown>;

  private items: T[];

  private constructor() {
    this.items = [];
  }

  public static getInstance<T>(): Queue<T> {
    if (!Queue.instance) {
      Queue.instance = new Queue<T>();
    }
    return Queue.instance as Queue<T>;
  }

  public push(element: T): void {
    this.items.push(element);
  }

  public shift(): T | undefined {
    return this.items.shift();
  }

  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  public size(): number {
    return this.items.length;
  }
}
