import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AlertComponent } from './auth/alert/alert.component';
import { RegisterComponent } from './auth/register/register.component';
import { AuthService } from './auth/services/auth.service';
import { AlertService } from './auth/services/alert.service';
import { UserService } from './auth/services/user.service';
import { UploadService } from './services/upload.service';
import { routing } from './route/app.routing';
import { HomeComponent } from './auth/home/home.component';
import { LoginComponent } from './auth/login/login.component';
import { AuthGuard } from './auth/guards/auth.guard';
import { RecoveryComponent } from './auth/recovery/recovery.component';
import { ResetComponent } from './auth/reset/reset.component';
import { TokenInterceptor } from './auth/interceptors/token.interceptor';
import { JwtInterceptor } from './auth/interceptors/jwt.interceptor';
import { HeaderComponent } from './header/header.component';
import { UploadComponent } from './upload/upload.component';
import { MainAuthComponent } from './auth/main-auth/main-auth.component';
import { MainDashComponent } from './main-dash/main-dash.component';


@NgModule({
  declarations: [
    AppComponent,
    RegisterComponent,
    AlertComponent,
    HomeComponent,
    LoginComponent,
    RecoveryComponent,
    ResetComponent,
    HeaderComponent,
    UploadComponent,
    MainAuthComponent,
    MainDashComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    routing
  ],
  providers: [
    AuthService,
    AlertService,
    UserService,
    UploadService,
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }