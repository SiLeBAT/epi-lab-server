import { createRepository, InstitutionSchema, IInstitutionModel } from '../data-store';
import { RepositoryBase, InstitutionRepository, Institution, createInstitution } from '../../../app/ports';
import { mapModelToInstitution } from './data-mappers';
import { ApplicationDomainError } from '../../../app/sharedKernel';

class DefaultInstitutionRepository implements InstitutionRepository {

    constructor(private baseRepo: RepositoryBase<IInstitutionModel>) {
    }

    findById(id: string): Promise<Institution> {
        return this.baseRepo.findById(id).then(
            m => {
                if (!m) throw new ApplicationDomainError(`Institute not found. id=${id}`);
                return mapModelToInstitution(m);
            }
        );
    }

    retrieve(): Promise<Institution[]> {
        return this.baseRepo.retrieve().then(
            modelArray => {
                return modelArray.map(m => mapModelToInstitution(m));
            }
        );
    }

    createInstitution(institution: Institution): Promise<Institution> {
        const newInstitution = new InstitutionSchema({
            state_short: institution.stateShort,
            name1: institution.name1,
            location: institution.location,
            phone: institution.phone,
            fax: institution.fax
        });
        return this.baseRepo.create(newInstitution).then(
			model => createInstitution(model._id.toHexString())
        );
    }

    findByInstitutionName(name: string): Promise<Institution> {
        return this.baseRepo.findOne({ name1: name }).then(
            (model: IInstitutionModel) => {
                if (!model) throw new ApplicationDomainError(`Institute not found. name=${name}`);
                return createInstitution(model._id.toHexString());
            }
        );
    }

}

export const repository: InstitutionRepository = new DefaultInstitutionRepository(createRepository(InstitutionSchema));
