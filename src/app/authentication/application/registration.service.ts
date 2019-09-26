import { logger } from '../../../aspects';
import {
    RegistrationService,
    UserRegistration,
    RequestActivationNotificationPayload,
    RequestAdminActivationNotificationPayload,
    AdminActivationNotificationPayload,
    AdminActivationReminderPayload,
    AlreadyRegisteredUserNotificationPayload
} from '../model/registration.model';
import {
    NotificationService,
    Notification,
    EmailNotificationMeta
} from '../../core/model/notification.model';
import { NotificationType } from '../../core/domain/enums';
import { createUser } from '../domain/user.entity';
import { RecoveryData } from '../model/login.model';
import { User, UserToken, UserService } from '../model/user.model';
import { TokenType } from '../domain/enums';
import { TokenService } from '../model/token.model';
import { ConfigurationService } from '../../core/model/configuration.model';
import { InstituteService } from '../model/institute.model';
import { injectable, inject } from 'inversify';
import { APPLICATION_TYPES } from './../../application.types';
import { UserAlreadyExistsError } from '../domain/domain.error';

@injectable()
export class DefaultRegistrationService implements RegistrationService {
    private appName: string;
    private apiUrl: string;
    private supportContact: string;

    constructor(
        @inject(APPLICATION_TYPES.NotificationService)
        private notificationService: NotificationService,
        @inject(APPLICATION_TYPES.TokenService)
        private tokenService: TokenService,
        @inject(APPLICATION_TYPES.ConfigurationService)
        private configurationService: ConfigurationService,
        @inject(APPLICATION_TYPES.UserService) private userService: UserService,
        @inject(APPLICATION_TYPES.InstituteService)
        private instituteService: InstituteService
    ) {
        this.appName = this.configurationService.getApplicationConfiguration().appName;
        this.apiUrl = this.configurationService.getApplicationConfiguration().apiUrl;
        this.supportContact = this.configurationService.getApplicationConfiguration().supportContact;
    }

    async verifyUser(token: string): Promise<string> {
        const userToken = await this.tokenService.getUserTokenByJWT(token);
        const userId = userToken.userId;
        this.tokenService.verifyTokenWithUser(token, String(userId));
        const user = await this.userService.getUserById(userId);
        user.isVerified(true);
        await this.userService.updateUser(user);
        await this.tokenService.deleteTokenForUser(user);
        await this.prepareUserForAdminActivation(user);
        logger.info(
            `${this.constructor.name}.${
                this.verifyUser.name
            }, User verification successful. token=${token}`
        );
        return user.email;
    }

    async activateUser(adminToken: string): Promise<string> {
        const userAdminToken = await this.tokenService.getUserTokenByJWT(
            adminToken
        );
        const userId = userAdminToken.userId;
        this.tokenService.verifyTokenWithUser(adminToken, String(userId));
        const user = await this.userService.getUserById(userId);
        user.isActivated(true);
        await this.userService.updateUser(user);
        await this.tokenService.deleteTokenForUser(user, TokenType.ADMIN);
        const adminActivationNotification = this.createAdminActivationNotification(
            user
        );
        this.notificationService.sendNotification(adminActivationNotification);
        const userName = user.firstName + ' ' + user.lastName;
        logger.verbose(
            `${this.constructor.name}.${
                this.activateUser.name
            }, User activation successful.`
        );
        return userName;
    }

    async registerUser(credentials: UserRegistration): Promise<void> {
        const result = await this.userService.hasUserWithEmail(
            credentials.email
        );
        if (result) {
            this.handleAlreadyRegisteredUser(credentials);
            throw new UserAlreadyExistsError(
                'Registration failed. User already exists'
            );
        }
        const inst = await this.instituteService.getInstituteById(
            credentials.institution
        );

        const newUser = createUser(
            '0000',
            credentials.email,
            credentials.firstName,
            credentials.lastName,
            inst,
            ''
        );

        await newUser.updatePassword(credentials.password);
        const user = await this.userService.createUser(newUser);
        const recoveryData: RecoveryData = {
            userAgent: credentials.userAgent,
            email: user.email,
            host: credentials.host
        };

        return this.prepareUserForVerification(user, recoveryData);
    }

    async prepareUserForVerification(
        user: User,
        recoveryData: RecoveryData
    ): Promise<void> {
        const hasOldToken = await this.tokenService.hasTokenForUser(user);
        if (hasOldToken) {
            await this.tokenService.deleteTokenForUser(user);
        }

        const token = this.tokenService.generateToken(user.uniqueId);

        const activationToken = await this.tokenService.saveToken(
            token,
            TokenType.ACTIVATE,
            user.uniqueId
        );

        const requestActivationNotification = this.createRequestActivationNotification(
            user,
            recoveryData,
            activationToken
        );

        return this.notificationService.sendNotification(
            requestActivationNotification
        );
    }

    handleNotActivatedUser(user: User): void {
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
        const hasOldAdminToken = await this.tokenService.hasTokenForUser(
            user,
            TokenType.ADMIN
        );
        if (hasOldAdminToken) {
            await this.tokenService.deleteTokenForUser(user, TokenType.ADMIN);
        }

        const adminToken = this.tokenService.generateAdminToken(user.uniqueId);

        const adminActivationToken = await this.tokenService.saveToken(
            adminToken,
            TokenType.ADMIN,
            user.uniqueId
        );

        const requestAdminActivationNotification = this.createRequestAdminActivationNotification(
            user,
            adminActivationToken
        );

        return this.notificationService.sendNotification(
            requestAdminActivationNotification
        );
    }

    private handleAlreadyRegisteredUser(credentials: UserRegistration): void {
        const userAlreadyRegisteredNotification = this.createAlreadyRegisteredUserNotification(
            credentials
        );
        return this.notificationService.sendNotification(
            userAlreadyRegisteredNotification
        );
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
                    this.apiUrl + '/users/activate/' + activationToken.token,
                api_url: this.apiUrl,
                operating_system: recoveryData.host,
                user_agent: recoveryData.userAgent,
                support_contact: this.supportContact,
                appName: this.appName
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                user.email,
                `Aktivieren Sie Ihr Konto für ${this.appName} `
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
                    this.apiUrl +
                    '/users/adminactivate/' +
                    adminActivationToken.token,
                api_url: this.apiUrl,
                email: user.email,
                institution: user.institution.name,
                location: user.institution.addendum,
                appName: this.appName
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                this.supportContact,
                `Aktivieren Sie das ${this.appName} Konto für ${fullName}`
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
                appName: this.appName,
                action_url: this.apiUrl + '/users/login',
                api_url: this.apiUrl
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                user.email,
                `Admin Aktivierung Ihres ${this.appName} Kontos`
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
                appName: this.appName,
                action_url: this.apiUrl + '/users/login',
                api_url: this.apiUrl
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                user.email,
                `Noch keine Admin Aktivierung Ihres ${this.appName} Kontos`
            )
        };
    }

    private createAdminActivationReminder(
        user: User
    ): Notification<AdminActivationReminderPayload, EmailNotificationMeta> {
        const fullName = user.firstName + ' ' + user.lastName;

        return {
            type: NotificationType.REMINDER_ADMIN_ACTIVATION,
            payload: {
                name: fullName,
                email: user.email,
                institution: user.institution.name,
                location: user.institution.addendum,
                appName: this.appName,
                api_url: this.apiUrl
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                this.supportContact,
                `Erinnerung: Bitte aktivieren Sie das ${
                    this.appName
                } Konto für ${fullName}`
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
                action_url: this.apiUrl + '/users/recovery',
                appName: this.appName,
                api_url: this.apiUrl
            },
            meta: this.notificationService.createEmailNotificationMetaData(
                credentials.email,
                `Ihre Registrierung für ein ${this.appName} Konto`
            )
        };
    }
}
