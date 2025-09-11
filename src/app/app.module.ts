// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.components';

@NgModule({
  imports: [BrowserModule, AppRoutingModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})

export class AppModule {}
