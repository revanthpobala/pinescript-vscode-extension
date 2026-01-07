export enum Qualifier {
    Const = 0,
    Input = 1,
    Simple = 2,
    Series = 3,
}

export interface PineType {
    name: string;
    qualifier: Qualifier;
}
