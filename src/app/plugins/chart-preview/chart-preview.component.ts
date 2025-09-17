import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { DatocmsService } from './datocms.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chart-plugin',
  imports: [CommonModule],
  standalone: true,
  template: `
    <section class="p-3">
      <!-- This is intentionally empty: you now have the data stream -->
      <h3>Chart plugin placeholder</h3>
      <p class="text-muted">
        The plugin is wired up. You’re receiving the current field’s
        <code>chart</code> block (if present).
      </p>

      <!-- For now we just show the raw JSON so you can verify the wiring -->
      <pre>{{ (chartData$ | async) | json }}</pre>
    </section>
  `,
})
export class ChartPreviewComponent {
  chartData$: Observable<any> = this.datocms.chartData$;
  constructor(private datocms: DatocmsService) {}
}
