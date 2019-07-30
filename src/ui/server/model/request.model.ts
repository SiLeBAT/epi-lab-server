import { SampleSetDTO } from './shared-dto.model';

export interface ResetRequestDTO {
    readonly email: string;
}

export interface NewPasswordRequestDTO {
    readonly password: string;
}
export interface RegistrationDetailsDTO {
    readonly email: string;
    readonly firstName: string;
    readonly instituteId: string;
    readonly lastName: string;
    readonly password: string;
}

export interface SampleSubmissionDTO {
    readonly order: SampleSetDTO;
    readonly comment: string;
}