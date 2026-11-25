/**
 * Email Service Module
 * Отправляет 6-значные коды подтверждения на почту.
 * Если заданы переменные SMTP в .env, шлет через реальный почтовый сервер.
 * Если нет - выводит красивое уведомление в консоль сервера для локальной разработки.
 */

const nodemailer = require('nodemailer');

class Mailer {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this._initTransporter();
  }

  _initTransporter() {
    try {
      require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
    } catch (e) {}

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host: host,
        port: port ? parseInt(port, 10) : 587,
        secure: port === '465',
        auth: { user, pass }
      });
      this.isConfigured = true;
      console.log(`[Mailer] Реальный SMTP настроен (${host}:${port || 587})`);
    } else {
      console.log('[Mailer] SMTP не настроен. Коды подтверждения выводятся в консоль сервера.');
    }
  }

  /**
   * Отправка кода подтверждения для входа
   */
  async sendLoginCode(email, code) {
    const subject = 'Код подтверждения для входа в Glade Launcher';
    const text = `Ваш код для входа в Glade Launcher: ${code}\nКод действителен 10 минут. Никому не сообщайте этот код.`;
    const html = `
      <div style="font-family: sans-serif; background: #0c0a09; color: #ece6e1; padding: 24px; border-radius: 12px; max-width: 480px;">
        <h2 style="color: #ff7a14; margin-top: 0;">GLADE LAUNCHER</h2>
        <p style="font-size: 15px; color: #ece6e1;">Вы запросили вход в аккаунт.</p>
        <p style="font-size: 14px; color: #8d817a;">Ваш одноразовый код подтверждения:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ff8a1f; background: #1a110c; padding: 12px 20px; border-radius: 8px; text-align: center; border: 1px solid #ff6a00; margin: 16px 0;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #6b5f58;">Код действует 10 минут. Если вы не запрашивали этот код, просто проигнорируйте письмо.</p>
      </div>
    `;

    return this._send({ to: email, subject, text, html, code, type: 'ВХОД' });
  }

  /**
   * Отправка кода восстановления пароля
   */
  async sendPasswordResetCode(email, code) {
    const subject = 'Сброс пароля в Glade Launcher';
    const text = `Ваш код для восстановления пароля: ${code}\nКод действителен 10 минут.`;
    const html = `
      <div style="font-family: sans-serif; background: #0c0a09; color: #ece6e1; padding: 24px; border-radius: 12px; max-width: 480px;">
        <h2 style="color: #ff7a14; margin-top: 0;">GLADE LAUNCHER</h2>
        <p style="font-size: 15px; color: #ece6e1;">Запрос на сброс пароля.</p>
        <p style="font-size: 14px; color: #8d817a;">Ваш код для подтверждения смены пароля:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ff8a1f; background: #1a110c; padding: 12px 20px; border-radius: 8px; text-align: center; border: 1px solid #ff6a00; margin: 16px 0;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #6b5f58;">Код действует 10 минут. Если вы не запрашивали смену пароля, смените пароль от почты.</p>
      </div>
    `;

    return this._send({ to: email, subject, text, html, code, type: 'ВОССТАНОВЛЕНИЕ ПАРОЛЯ' });
  }

  async _send({ to, subject, text, html, code, type }) {
    // В консоли всегда логируем для разработчика
    console.log('\n==================================================');
    console.log(`📬 [EMAIL] Отправка письма (${type})`);
    console.log(`   Кому: ${to}`);
    console.log(`   Тема: ${subject}`);
    console.log(`   👉 КОД ПОДТВЕРЖДЕНИЯ: [ ${code} ]`);
    console.log('==================================================\n');

    if (this.isConfigured && this.transporter) {
      try {
        const fromAddress = process.env.SMTP_FROM || `"Glade Launcher" <${process.env.SMTP_USER || 'noreply@glade.ru'}>`;
        const info = await this.transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text,
          html
        });
        console.log(`[Mailer] Письмо успешно отправлено через SMTP (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        console.error('[Mailer] Ошибка отправки через SMTP:', err.message);
        // Не роняем процесс, так как код залогирован в консоль
        return { success: false, error: err.message, devCode: code };
      }
    }

    return { success: true, devMode: true, devCode: code };
  }
}

module.exports = new Mailer();
