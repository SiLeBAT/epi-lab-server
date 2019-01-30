import * as moment from 'moment';
import * as _ from 'lodash';
import { Request, Response } from 'express';
import { logger } from '../../../aspects';
import { FormValidatorPort, IFormAutoCorrectionPort, IController, SampleCollection, Sample, createSample, createSampleCollection } from '../../../app/ports';
import { ApplicationSystemError } from '../../../app/sharedKernel/errors';
import { ValidationOptions } from '../../../app/sampleManagement/application';
import { CorrectionSuggestions, EditValue } from '../../../app/sampleManagement/domain';

moment.locale('de');

interface ValidationRequestMeta {
    state: string;
    nrl: string;
}

interface ValidationRequest {
    data: SampleDTO[];
    meta: ValidationRequestMeta;
}

interface ValidationResponseDTO {
    data: SampleDTO;
    errors: ErrorResponseDTO;
    corrections: CorrectionSuggestions[];
    edits: Record<string, EditValue>;
}

interface SampleDTO {
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

interface ErrorDTO {
    code: number;
    level: number;
    message: string;
}

interface ErrorResponseDTO {
    [key: string]: ErrorDTO[];
}

export interface ValidationController extends IController {
    validateSamples(req: Request, res: Response): Promise<void>;
}

class DefaultValidationController implements ValidationController {

    constructor(private formValidationService: FormValidatorPort, private formAutoCorrectionService: IFormAutoCorrectionPort) { }

    async validateSamples(req: Request, res: Response) {

        if (req.is('application/json')) {
            try {
                const sampleCollection: SampleCollection = this.fromDTOToSamples(req.body);
                const validationOptions: ValidationOptions = req.body.meta;
                // Auto-correction needs to happen before validation?
                const autocorrectedSamples = await this.formAutoCorrectionService.applyAutoCorrection(sampleCollection);
                const validationResult = await this.formValidationService.validateSamples(autocorrectedSamples, validationOptions);
                const validationResultsDTO = this.fromErrorsToDTO(validationResult);
                logger.info('ValidationController.validateSamples, Response sent');
                logger.verbose('Response:', validationResultsDTO);
                res.status(200)
                    .json(validationResultsDTO);
            } catch (err) {
                res.status(500).end();
                throw err;
            }

        } else {
            res.status(501);
        }

        return res.end();

    }

    private fromErrorsToDTO(sampleCollection: SampleCollection): ValidationResponseDTO[] {

        return sampleCollection.samples.map((sample: Sample) => {
            const errors: ErrorResponseDTO = {};
            const errorArray: number[] = [];
            _.forEach(sample.getErrors(), (e, i) => {
                errors[i] = e.map(f => {
                    errorArray.push(f.code);
                    return {
                        code: f.code,
                        level: f.level,
                        message: f.message
                    };
                });
            });
            const data = sample.getData();
            data.comment = errorArray.toString();
            return {
                data: data,
                errors: errors,
                corrections: sample.correctionSuggestions,
                edits: sample.edits
            };

        });
    }

    private fromDTOToSamples(dto: ValidationRequest): SampleCollection {
        if (!Array.isArray(dto.data)) {
            throw new ApplicationSystemError(`Invalid input: Array expected, dto.data=${dto.data}`);
        }
        const samples = dto.data.map(s => createSample({ ...s }));

        return createSampleCollection(samples);
    }

}

export function createController(validationService: FormValidatorPort, autocorrectionService: IFormAutoCorrectionPort) {
    return new DefaultValidationController(validationService, autocorrectionService);
}
