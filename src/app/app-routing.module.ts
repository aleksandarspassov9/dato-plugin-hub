// src/app/app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'excel-json', loadChildren: () => import('./plugins/excel-json/excel-json.module').then(m => m.ExcelJsonModule) },
  { path: '', pathMatch: 'full', redirectTo: 'excel-json' },
  { path: '**', redirectTo: 'excel-json' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],   // ✅ important
})
export class AppRoutingModule {}
