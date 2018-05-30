import * as path from 'path';
import * as config from 'config';
import * as csv from 'fast-csv';
import * as rootDir from 'app-root-dir';

import { logger } from './../../../aspects';
import { ICatalogRepository, ICatalog, Catalog } from './../../../app/ports';

class FileCatalogRepository implements ICatalogRepository {
    private catalogs: {
        // tslint:disable-next-line
        [key: string]: ICatalog<any>;
    };
    constructor(private dataDir: string) {
        this.dataDir = this.dataDir || path.join(rootDir.get(), 'data');
        this.catalogs = {};
    }

    initialise() {
        logger.verbose('Loading Catalog data from Filesystem', { dataDir: this.dataDir });
        return Promise.all([
            this.importCSVFile(path.join(this.dataDir, 'ADV2.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ADV3.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ADV4.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ADV8.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ADV9.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ADV12.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ADV16.csv')),
            this.importCSVFile(path.join(this.dataDir, 'BW_Grund_Codes.csv')),
            this.importCSVFile(path.join(this.dataDir, 'BW_Matrix_Codes.csv')),
            this.importCSVFile(path.join(this.dataDir, 'BW_MatrixOberbegriff_Codes.csv')),
            this.importCSVFile(path.join(this.dataDir, 'NRLs_u_Erreger.csv')),
            this.importCSVFile(path.join(this.dataDir, 'PLZ.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ZSP2017.csv')),
            this.importCSVFile(path.join(this.dataDir, 'ZSP2018.csv'))
        ]).then(
            (data) => {
                // tslint:disable-next-line
                this.catalogs['adv2'] = new Catalog<any>(data[0], 'Kode');
                // tslint:disable-next-line
                this.catalogs['adv3'] = new Catalog<any>(data[1]);
                // tslint:disable-next-line
                this.catalogs['adv4'] = new Catalog<any>(data[2], 'Kode');
                // tslint:disable-next-line
                this.catalogs['adv8'] = new Catalog<any>(data[3], 'Kode');
                // tslint:disable-next-line
                this.catalogs['adv9'] = new Catalog<any>(data[4], 'Kode');
                // tslint:disable-next-line
                this.catalogs['adv12'] = new Catalog<any>(data[5], 'Kode');
                // tslint:disable-next-line
                this.catalogs['adv16'] = new Catalog<any>(data[6], 'Kode');
                // tslint:disable-next-line
                this.catalogs['bw_grund'] = new Catalog<any>(data[7], 'Kode');
                // tslint:disable-next-line
                this.catalogs['bw_matrix'] = new Catalog<any>(data[8], 'Kode');
                // tslint:disable-next-line
                this.catalogs['bw_ober'] = new Catalog<any>(data[9], 'Kode');
                // tslint:disable-next-line
                this.catalogs['erreger'] = new Catalog<any>(data[10]);
                // tslint:disable-next-line
                this.catalogs['plz'] = new Catalog(<any>data[11], 'plz');
                // tslint:disable-next-line
                this.catalogs['zsp2017'] = new Catalog<any>(data[12]);
                // tslint:disable-next-line
                this.catalogs['zsp2018'] = new Catalog(<any>data[13]);
                logger.info('Finished initialising Catalog Repository from Filesystem', { dataDir: this.dataDir });
            }
        );
    }
    // tslint:disable-next-line
    getCatalog(catalogName: string): ICatalog<any> {
        return this.catalogs[catalogName];
    }
    // tslint:disable-next-line
    private importCSVFile(filePath: string): Promise<any[]> {
        // tslint:disable-next-line
        let data: any[] = [];

        return new Promise(function (resolve, reject) {
            csv
                .fromPath(filePath, { headers: true })
                .on('data', function (entry) {
                    data.push(entry);
                })
                .on('end', function () {
                    resolve(data);
                });
        });
    }
}
export const repository = new FileCatalogRepository(config.get('dataStore.dataDir'));

export function initialiseRepository() {
    return repository.initialise().then(
        () => {
            return repository;
        }
    );
}