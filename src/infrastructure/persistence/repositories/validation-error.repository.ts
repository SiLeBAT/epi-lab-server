import { ValidationErrorRepository, ValidationError } from '../../../app/ports';
import { mapModelToValidationError } from './data-mappers';
import { ValidationErrorModel } from '../data-store/mongoose/schemas/validation-error.schema';
import { MongooseRepositoryBase } from '../data-store/mongoose/mongoose.repository';
import { injectable, inject } from 'inversify';
import { Model } from 'mongoose';
import { PERSISTENCE_TYPES } from '../persistence.types';
@injectable()
export class DefaultValidationErrorRepository
    extends MongooseRepositoryBase<ValidationErrorModel>
    implements ValidationErrorRepository {
    constructor(
        @inject(PERSISTENCE_TYPES.ValidationErrorModel)
        model: Model<ValidationErrorModel>
    ) {
        super(model);
    }

    async getAllErrors(): Promise<ValidationError[]> {
        return super
            ._retrieve()
            .then(modelArray => {
                return modelArray.map(m => mapModelToValidationError(m));
            })
            .catch(error => {
                throw error;
            });
    }
}
