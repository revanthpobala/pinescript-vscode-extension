export enum Qualifier {
    Const = 0,
    Input = 1,
    Simple = 2,
    Series = 3,
    Param = 4,  // Function parameters - should not be flagged as unused
}

export interface PineType {
    name: string;
    qualifier: Qualifier;
}
