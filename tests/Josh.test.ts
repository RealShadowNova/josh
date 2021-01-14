import { Josh } from '../src/index';

describe('Basic Initialization', () => {
  it('Should fail without options', () => {
    // @ts-expect-error 2554
    expect(() => new Josh()).toThrow();
  });
});
