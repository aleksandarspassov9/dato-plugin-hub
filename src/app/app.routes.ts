import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'excel-json',
    loadChildren: () =>
      import('./plugins/excel-json/excel-json.routes').then(m => m.routes),
  },
  { path: '', pathMatch: 'full', redirectTo: 'excel-json' },
  { path: '**', redirectTo: 'excel-json' },
];
