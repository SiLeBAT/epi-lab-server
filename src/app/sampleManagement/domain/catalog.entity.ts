import _ from 'lodash';
import Fuse from 'fuse.js';
import { ApplicationDomainError } from '../../core/domain/domain.error';
import { Catalog, CatalogData } from '../model/catalog.model';

class DefaultCatalog<T extends CatalogData> implements Catalog<T> {
    constructor(private data: T[], private uId: string = '') {}

    containsUniqueEntryWithId(id: string): boolean {
        return !!this.getUniqueEntryWithId(id);
    }

    containsEntryWithKeyValue(key: string, value: string): boolean {
        return !(this.getEntriesWithKeyValue(key, value).length === 0);
    }

    hasUniqueId(): boolean {
        return !!this.getUniqueId();
    }

    getUniqueId(): string {
        return this.uId;
    }

    getEntriesWithKeyValue(key: string, value: string): T[] {
        // tslint:disable-next-line
        return _.filter(this.data, (e: any) => e[key] === value);
    }

    getUniqueEntryWithId(id: string): T {
        if (!this.hasUniqueId()) {
            throw new ApplicationDomainError(
                `Invalid Operation: No Unique Id defined for this Catalog id=${id}`
            );
        }
        return this.getEntriesWithKeyValue(this.uId, id)[0];
    }

    dump(): T[] {
        return this.data;
    }

    getFuzzyIndex(
        options: Fuse.IFuseOptions<T>,
        enhancements: T[] = []
    ): Fuse<T> {
        const data = this.dump();
        return new Fuse(data.concat(enhancements), options);
    }
}

function createCatalog<T extends CatalogData>(
    data: T[],
    uId: string = ''
): Catalog<T> {
    return new DefaultCatalog(data, uId);
}

export { createCatalog };
