import { logger } from '../../../aspects';
import {
    RegistrationService,
    UserRegistration,
    RequestActivationNotificationPayload,
    RequestAdminActivationNotificationPayload,
    RequestForUnknownInstituteNotificationPayload,
    AdminActivationNotificationPayload,
    AdminActivationReminderPayload,
    AlreadyRegisteredUserNotificationPayload
} from '../model/registration.model';
import { getConfigurationService } from '../../core/application/configuration.service';
import {
    NotificationService,
    Notification,
    EmailNotificationMeta
} from '../../core/model/notification.model';
import { NotificationType } from '../../core/domain/enums';
import {
    verifyToken,
    generateToken,
    generateAdminToken
} from '../domain/token.service';
import { ApplicationDomainError } from '../../core/domain/domain.error';
import { createUser } from '../domain/user.entity';
import { RecoveryData } from '../model/login.model';
import { User, UserToken } from '../model/user.model';
import { TokenType } from '../domain/enums';
import { createInstitution } from '../domain/institute.entity';
import {
    UserRepository,
    TokenRepository,
    InstituteRepository
} from '../../ports';

const appConfig = getConfigurationService().getApplicationConfiguration();
const serverConfig = getConfigurationService().getServerConfiguration();
const generalConfig = getConfigurationService().getGeneralConfiguration();

const APP_NAME = appConfig.appName;
const API_URL = serverConfig.apiUrl;
const SUPPORT_CONTACT = generalConfig.supportContact;

class DefaultRegistrationService implements RegistrationService {
    constructor(
        private userRepository: UserRepository,
        private tokenRepository: TokenRepository,
        private institutionRepository: InstituteRepository,
        private notificationService: NotificationService
    ) {}

    async activateUser(token: string): Promise<void> {
        const userToken = await this.tokenRepository.getUserTokenByJWT(token);
        const userId = userToken.userId;
        verifyToken(token, String(userId));
        const user = await this.userRepository.findById(userId);
        user.isActivated(true);
        await this.userRepository.updateUser(user);
        await this.tokenRepository.deleteTokenForUser(user);
        await this.prepareUserForAdminActivation(user);
        logger.info(
            `RegistrationService.activateUser, User activation successful. token=${token}`
        );
    }

    async adminActivateUser(adminToken: string): Promise<string> {
        const userAdminToken = await this.tokenRepository.getUserTokenByJWT(
            adminToken
        );
        const userId = userAdminToken.userId;
        verifyToken(adminToken, String(userId));
        const user = await this.userRepository.findById(userId);
        user.isAdminActivated(true);
        await this.userRepository.updateUser(user);
        await this.tokenRepository.deleteAdminTokenForUser(user);
        const adminActivationNotification = this.createAdminActivationNotification(
            user
        );
        this.notificationService.sendNotification(adminActivationNotification);
        const userName = user.firstName + ' ' + user.lastName;
        logger.verbose(
            'RegistrationService.adminActivateUser, User admin activation successful'
        );
        return userName;
    }

    async registerUser(credentials: UserRegistration): Promise<void> {
        let instituteIsUnknown = false;
        const result = await this.userRepository.hasUser(credentials.email);
        if (result) {
            await this.handleAlreadyRegisteredUser(credentials);
            throw new ApplicationDomainError(
                'Registration failed. User already exists'
            );
        }

        let inst;
        try {
            inst = await this.institutionRepository.findById(
                credentials.institution
            );
        } catch (err) {
            logger.error(
                `RegistrationService.registerUser, Unable to find instituton: error=${err}`
            );
            logger.info(
                'RegistrationService.registerUser, link registered user to dummy institution'
            );
            instituteIsUnknown = true;
            inst = await this.getDummyInstitution();
        }

        if (!inst) {
            throw new ApplicationDomainError(
                `Institution not found, id=${credentials.institution}`
            );
        }

        const newUser = createUser(
            '0000',
            credentials.email,
            credentials.firstName,
            credentials.lastName,
            inst,
            ''
        );

        await newUser.updatePassword(credentials.password);
        const user = await this.userRepository.createUser(newUser);
        const recoveryData: RecoveryData = {
            userAgent: credentials.userAgent,
            email: user.email,
            host: credentials.host
        };

        if (instituteIsUnknown) {
            const requestAdminActivationNotification = this.createRequestForUnknownInstituteNotification(
                user,
                credentials.institution
            );
            this.notificationService.sendNotification(
                requestAdminActivationNotification
            );
        }
        return this.prepareUserForActivation(user, recoveryData);
    }

    async prepareUserForActivation(
        user: User,
        recoveryData: RecoveryData
    ): Promise<void> {
        const hasOldToken = await this.tokenRepository.hasTokenForUser(user);
        if (hasOldToken) {
            await this.tokenRepository.deleteTokenForUser(user);
        }

        const token = generateToken(user.uniqueId);

        const activationToken = await this.tokenRepository.saveToken({
            token: token,
            type: TokenType.ACTIVATE,
            userId: user.uniqueId
        });

        const requestActivationNotification = this.createRequestActivationNotification(
            user,
            recoveryData,
            activationToken
        );

        return this.notificationService.sendNotification(
            requestActivationNotification
        );
    }

    async handleUserIfNotAdminActivated(user: User): Promise<void> {
        const requestNotAdminActivatedNotification = this.createNotAdminActivatedNotification(
            user
        );
        this.notificationService.sendNotification(
            requestNotAdminActivatedNotification
        );

        const requestAdminActivationReminder = this.createAdminActivationReminder(
            user
        );

        return this.notificationService.sendNotification(
            requestAdminActivationReminder
        );
    }

    private async prepareUserForAdminActivation(user: User): Promise<void> {
        const hasOldAdminToken = await this.tokenRepository.hasAdminTokenForUser(
            user
        );
        if (hasOldAdminToken) {
            await this.tokenRepository.deleteAdminTokenForUser(user);
        }

        const adminToken = generateAdminToken(user.uniqueId);

        const adminActivationToken = await this.tokenRepository.saveToken({
            token: adminToken,
            type: TokenType.ADMIN,
            userId: user.uniqueId
        });

        const requestAdminActivationNotification = this.createRequestAdminActivationNotification(
            user,
            adminActivationToken
        );

        return this.notificationService.sendNotification(
            requestAdminActivationNotification
        );
    }

    private async handleAlreadyRegisteredUser(
        credentials: UserRegistration
    ): Promise<void> {
        const userAlreadyRegisteredNotification = this.createAlreadyRegisteredUserNotification(
            credentials
        );
        return this.notificationService.sendNotification(
            userAlreadyRegisteredNotification
        );
    }

    private async getDummyInstitution() {
        let inst;

        try {
            inst = await this.institutionRepository.findByInstitutionName(
                'dummy'
            );
        } catch (error) {
            logger.warn(
                `Dummy institute doesn't exists: Creating! error=${error}`
            );
            const newInstitution = createInstitution('0000');
            newInstitution.stateShort = 'dummy';
            newInstitution.name = 'dummy';
            newInstitution.city = 'dummy';
            newInstitution.zip = 'dummy';
            newInstitution.phone = 'dummy';
            newInstitution.fax = 'dummy';

            inst = await this.institutionRepository.createInstitution(
                newInstitution
            );
        }

        return inst;
    }

    private createRequestActivationNotification(
        user: User,
        recoveryData: RecoveryData,
        activationToken: UserToken
    ): Notification<
        RequestActivationNotificationPayload,
        EmailNotificationMeta
    > {
        return {
            type: NotificationType.REQUEST_ACTIVATION,
            payload: {
                name: user.firstName + ' ' + user.lastName,
                action_url:
                    API_URL + '/users/activate/' + activationToken.token,
                api_url: API_URL,
                operating_system: recoveryData.host,
                user_agent: recoveryData.userAgent,
                support_contact: SUPPORT_CONTACT,
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                user.email,
                `Aktivieren Sie Ihr Konto für ${APP_NAME} `
            )
        };
    }

    private createRequestAdminActivationNotification(
        user: User,
        adminActivationToken: UserToken
    ): Notification<
        RequestAdminActivationNotificationPayload,
        EmailNotificationMeta
    > {
        const fullName = user.firstName + ' ' + user.lastName;

        return {
            type: NotificationType.REQUEST_ADMIN_ACTIVATION,
            payload: {
                name: fullName,
                action_url:
                    API_URL +
                    '/users/adminactivate/' +
                    adminActivationToken.token,
                api_url: API_URL,
                email: user.email,
                institution: user.institution.name,
                location: user.institution.addendum,
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                SUPPORT_CONTACT,
                `Aktivieren Sie das ${APP_NAME} Konto für ${fullName}`
            )
        };
    }

    private createRequestForUnknownInstituteNotification(
        user: User,
        institution: string
    ): Notification<
        RequestForUnknownInstituteNotificationPayload,
        EmailNotificationMeta
    > {
        const fullName = user.firstName + ' ' + user.lastName;

        return {
            type: NotificationType.REQUEST_UNKNOWN_INSTITUTE,
            payload: {
                name: fullName,
                api_url: API_URL,
                email: user.email,
                institution: institution,
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                SUPPORT_CONTACT,
                `Aktivierungsanfrage für das ${APP_NAME} Konto von ${fullName} mit nicht registriertem Institut`
            )
        };
    }

    private createAdminActivationNotification(
        user: User
    ): Notification<AdminActivationNotificationPayload, EmailNotificationMeta> {
        const fullName = user.firstName + ' ' + user.lastName;

        return {
            type: NotificationType.NOTIFICATION_ADMIN_ACTIVATION,

            payload: {
                name: fullName,
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                user.email,
                `Admin Aktivierung Ihres ${APP_NAME} Kontos`
            )
        };
    }

    private createNotAdminActivatedNotification(
        user: User
    ): Notification<AdminActivationNotificationPayload, EmailNotificationMeta> {
        const fullName = user.firstName + ' ' + user.lastName;

        return {
            type: NotificationType.NOTIFICATION_NOT_ADMIN_ACTIVATED,
            payload: {
                name: fullName,
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                user.email,
                `Noch keine Admin Aktivierung Ihres ${APP_NAME} Kontos`
            )
        };
    }

    private createAdminActivationReminder(
        user: User
    ): Notification<AdminActivationReminderPayload, EmailNotificationMeta> {
        const fullName = user.firstName + ' ' + user.lastName;

        return {
            type: NotificationType.NOTIFICATION_ALREADY_REGISTERED,
            payload: {
                name: fullName,
                email: user.email,
                institution: user.institution.name,
                location: user.institution.addendum,
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                SUPPORT_CONTACT,
                `Erinnerung: Bitte aktivieren Sie das ${APP_NAME} Konto für ${fullName}`
            )
        };
    }

    private createAlreadyRegisteredUserNotification(
        credentials: UserRegistration
    ): Notification<
        AlreadyRegisteredUserNotificationPayload,
        EmailNotificationMeta
    > {
        const fullName = credentials.firstName + ' ' + credentials.lastName;

        return {
            type: NotificationType.NOTIFICATION_ALREADY_REGISTERED,
            payload: {
                name: fullName,
                action_url: API_URL + '/users/recovery',
                appName: APP_NAME
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                credentials.email,
                `Ihre Registrierung für ein ${APP_NAME} Konto`
            )
        };
    }
}

export function createService(
    userRepository: UserRepository,
    tokenRepository: TokenRepository,
    institutionRepository: InstituteRepository,
    notificationService: NotificationService
): RegistrationService {
    return new DefaultRegistrationService(
        userRepository,
        tokenRepository,
        institutionRepository,
        notificationService
    );
}
