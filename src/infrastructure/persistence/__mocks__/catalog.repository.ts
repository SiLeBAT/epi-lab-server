import { CatalogData, Catalog, CatalogRepository } from '../../../app/ports';

const mockFuse = {
    search: jest.fn(() => [])
};
// tslint:disable-next-line: no-any
const mockCatalog: Catalog<any> = {
    getEntriesWithKeyValue: jest.fn(() => []),
    getUniqueEntryWithId: jest.fn(),
    containsUniqueEntryWithId: jest.fn(),
    containsEntryWithKeyValue: jest.fn(),
    hasUniqueId: jest.fn(),
    getUniqueId: jest.fn(),
    getFuzzyIndex: jest.fn(() => mockFuse),
    dump: jest.fn()
};

export function getMockCatalogRepository(): CatalogRepository {
    return {
        getCatalog: jest.fn(() => mockCatalog)
    };
}
