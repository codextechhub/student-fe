import { describe, expect, it } from "vitest";

import { feeFigures } from "./fee-figures";

describe("feeFigures", () => {
  it("keeps owing and credit apart when the school sends both", () => {
    expect(feeFigures({ balance: 0, owing: 15_000_000, credit: 15_000_000 })).toEqual({ owing: 15_000_000, credit: 15_000_000 });
  });

  it("reads an older copy that carries only the net balance", () => {
    expect(feeFigures({ balance: 5_000 })).toEqual({ owing: 5_000, credit: 0 });
    expect(feeFigures({ balance: -5_000 })).toEqual({ owing: 0, credit: 5_000 });
    expect(feeFigures({ balance: 0 })).toEqual({ owing: 0, credit: 0 });
  });
});
