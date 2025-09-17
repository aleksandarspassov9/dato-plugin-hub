import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'chart-preview',
    loadChildren: () =>
      import('./plugins/chart-preview/chart-preview.routes').then(m => m.routes),
  },{
    path: 'excel-json',
    loadChildren: () =>
      import('./plugins/excel-json/excel-json.routes').then(m => m.routes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'excel-json' },
];
