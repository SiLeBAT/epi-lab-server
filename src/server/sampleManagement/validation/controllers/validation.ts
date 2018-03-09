import * as path from 'path';
import * as fs from 'fs';
import * as moment from 'moment';
import * as _ from 'lodash';
import * as rootDir from 'app-root-dir';
import * as unirest from 'unirest';
import * as config from 'config';
import { multerUpload } from './../middleware';
import { Request, Response, NextFunction } from 'express';
import { logger, ServerError } from './../../../../aspects';
import { validateSamples as validate, createSample } from './../interactors';
import { ISampleCollection, createSampleCollection, ISample } from './../entities';
import { IValidationErrorCollection } from '../entities/validation';

moment.locale('de');

interface IValidationRequest extends Array<ISampleDTO> { }

interface ISampleDTO {
    sample_id: string;
    sample_id_avv: string;
    pathogen_adv: string;
    pathogen_text: string;
    sampling_date: string;
    isolation_date: string;
    sampling_location_adv: string;
    sampling_location_zip: string;
    sampling_location_text: string;
    topic_adv: string;
    matrix_adv: string;
    matrix_text: string;
    process_state_adv: string;
    sampling_reason_adv: string;
    sampling_reason_text: string;
    operations_mode_adv: string;
    operations_mode_text: string;
    vvvo: string;
    comment: string;
}

interface IKnimeConfig {
    user: string;
    pass: string;
    urlJobId: string;
    urlResult: string;
}

interface IErrorDTO {
    code: number;
    level: number;
    message: string;
}

interface IErrorResponseDTO {
    [key: string]: IErrorDTO[];
}

const knimeConfig: IKnimeConfig = config.get('knime');
const appRootDir = rootDir.get();

export function validateSamples(req: Request, res: Response) {
    if (req.is('application/json')) {
        return validateSamplesViaJS(req, res);
    } else {
        return multerUpload(req, res, function (err) {
            if (err) {
                logger.error('Unable to save Dataset.');
                return res
                    .status(400)
                    .end();
            }
            const uploadedFilePath = path.join(appRootDir, req.file.path);
            return getKnimeJobId(req, res, uploadedFilePath);
        });
    }

}

function validateSamplesViaJS(req: Request, res: Response) {
    logger.info('JSON POST request received');
    const samples: ISampleCollection = fromDTOToSamples(req.body);
    const rawValidationResult = validate(samples);
    const formattedValidationResult = fromErrorsToDTO(rawValidationResult);
    return res
        .status(200)
        .json(formattedValidationResult);
}

function fromErrorsToDTO(samples: ISampleCollection) {

    return samples.getSamples().map((s: ISample) => {
        let errors: IErrorResponseDTO = {};
        _.forEach(s.getErrors(), (e, i) => {
            errors[i] = e.map(f => ({
                code: f.code,
                level: f.level,
                message: f.message
            }));
        });
        return {
            data: s.getData(),
            errors: errors
        };

    });
}

function fromDTOToSamples(dto: IValidationRequest): ISampleCollection {
    if (!Array.isArray(dto)) {
        throw new ServerError('Invalid input: Array expected');
    }
    const samples = dto.map(s => createSample({ ...s }));

    return createSampleCollection(samples);
}

function getKnimeJobId(req: Request, res: Response, filePath: string) {
    logger.info('Retrieving Knime Job ID.');

    const urlJobId = knimeConfig.urlJobId;
    const user = knimeConfig.user;
    const pass = knimeConfig.pass;

    unirest
        .post(urlJobId)
        .auth({
            user: user,
            pass: pass
        })
        // tslint:disable-next-line
        .end((response: any) => {
            if (response.error) {
                logger.error('knime id error: ', response.error);

                return res
                    .status(400)
                    .json({
                        title: 'knime id error',
                        obj: response.error
                    });
            }

            const jobId = response.body['id'];
            doKnimeValidation(req, res, jobId, filePath);
        });

}

function doKnimeValidation(req: Request, res: Response, jobId: string, filePath: string) {

    const urlResult = knimeConfig.urlResult + jobId;
    const user = knimeConfig.user;
    const pass = knimeConfig.pass;

    unirest
        .post(urlResult)
        .headers({
            'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
        })
        .auth({
            user: user,
            pass: pass
        })
        .attach({
            'file-upload-210': fs.createReadStream(filePath)
        })
        // tslint:disable-next-line
        .end((response: any) => {
            if (response.error) {
                logger.error('knime validation error: ', response.error);

                return res
                    .status(400)
                    .json({
                        title: 'knime validation error',
                        obj: response.error
                    });
            }

            return res
                .status(200)
                .json({
                    title: 'file upload and knime validation ok',
                    obj: response.raw_body
                });
        });
}
