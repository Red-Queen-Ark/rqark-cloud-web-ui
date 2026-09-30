interface TAlert {
  alertList: TAlertItem[];
  timeout: number;
}

interface TAlertItem {
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  uuid?: string;
  timeLog?: string;
}

interface TAlertInputItem {
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
