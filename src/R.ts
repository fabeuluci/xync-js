export type IWhenable<T> = T|IPromisable<T>;
export type ICallback<T, U> = (v: T) => IWhenable<U>;

export interface IPromisable<T> {
    then<U>(func: (ICallback<T, U>)): IPromisable<U>;
    catch(func: (e: any) => any): any;
}

export interface IResult<T> extends IPromisable<T> {
    sync(): T;
    async(): Promise<T>;
    then<U>(func: ICallback<T, U>): IResult<U>;
    catch(func: (e: any) => any): void;
}

export interface IDeffered<T> {
    resolve(value: T): void;
    reject(e: any): void;
    promise: Promise<T>;
}

export class ValueResult<T> implements IResult<T> {
    
    promiseMode: boolean;
    
    success: boolean;
    value: T;
    error: any;
    
    promise: IPromisable<T>;
    toResolve: IDeffered<T>[];
    toFail: ((e: any) => any)[];
    resolved: boolean;
    
    constructor() {
    }
    
    static createPromise<T>(promise: IPromisable<T>): ValueResult<T> {
        let result = new ValueResult<T>();
        result.promiseMode = true;
        result.promise = promise;
        result.toResolve = [];
        result.toFail = [];
        result.promise.then(result.resolve.bind(result)).catch(result.reject.bind(result));
        return result;
    }
    
    static createResult<T>(value: T): ValueResult<T> {
        let res = new ValueResult<T>();
        res.success = true;
        res.value = value;
        return res;
    }
    
    static createError<T>(error: any): ValueResult<T> {
        let result = new ValueResult<T>();
        result.success = false;
        result.error = error;
        return result;
    }
    
    static createDefer<T>(): IDeffered<T> {
        let result: IDeffered<T> = {
            resolve: null,
            reject: null,
            promise: null
        };
        let a = new Promise<T>(() => {});
        result.promise = new Promise<T>((resolve, reject) => {
            result.resolve = resolve;
            result.reject = reject;
        });
        return result;
    }
    
    sync(): T {
        if (this.promiseMode) {
            throw new Error("Not supported sync mode");
        }
        if (this.success) {
            return this.value;
        }
        throw this.error;
    }
    
    async(): Promise<T> {
        if (this.promiseMode && !this.resolved) {
            let defer = ValueResult.createDefer<T>();
            this.toResolve.push(defer);
            return defer.promise;
        }
        return this.success ? Promise.resolve(this.value) : Promise.reject<T>(this.error);
    }
    
    resolve(value: T): void {
        if (this.resolved) {
            return;
        }
        this.success = true;
        this.value = value;
        this.resolved = true;
        this.toResolve.forEach(x => {
            x.resolve(this.value);
        });
        delete this.promise;
        delete this.toResolve;
        delete this.toFail;
    }
    
    reject(error: any): void {
        if (this.resolved) {
            return;
        }
        this.success = false;
        this.error = error;
        this.resolved = true;
        this.toResolve.forEach(x => {
            x.reject(this.error);
        });
        this.toFail.forEach(x => {
            try {
                x(this.error);
            }
            catch (e) {
                console.log("Fail callback fails", this.error, e);
            }
        });
        delete this.promise;
        delete this.toResolve;
        delete this.toFail;
    }
    
    then<U>(func: ICallback<T, U>): IResult<U> {
        if (this.promiseMode && !this.resolved) {
            let defer = ValueResult.createDefer<T>();
            this.toResolve.push(defer);
            return ValueResult.createPromise(defer.promise.then(func));
        }
        if (!this.success) {
            return ValueResult.createError<U>(this.error);
        }
        try {
            let u = func(this.value);
            if (u instanceof ValueResult && !u.promiseMode) {
                if (u.success) {
                    return ValueResult.createResult<U>(u.value);
                }
                else {
                    return ValueResult.createError<U>(u.error);
                }
            }
            else if (u != null && typeof((<any>u).then) == "function") {
                return ValueResult.createPromise(<IPromisable<U>>u);
            }
            return ValueResult.createResult(<U>u);
        }
        catch (e) {
            return ValueResult.createError<U>(e);
        }
    }
    
    catch(func: (e: any) => any): void {
        if (this.promiseMode && !this.resolved) {
            this.toFail.push(func);
            return;
        }
        try {
            func(this.error);
        }
        catch (e) {
            console.log("Fail callback fails", this.error, e);
        }
    }
}

export function R<T>(func: ICallback<void, T>): IResult<T> {
    return ValueResult.createResult(null).then(func);
}

export function RV<T>(value: T): IResult<T> {
    return ValueResult.createResult(value);
}
