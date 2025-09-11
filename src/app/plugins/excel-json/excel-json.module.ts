import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ExcelJsonPageComponent } from './excel-json.page';
import { ConfigComponent } from './config.component';
import { FieldEditorComponent } from './field-editor.component';

@NgModule({
  declarations: [ExcelJsonPageComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: ExcelJsonPageComponent }]),
    ConfigComponent,
    FieldEditorComponent,
  ],
})
export class ExcelJsonModule {}
