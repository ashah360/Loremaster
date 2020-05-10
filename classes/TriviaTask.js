const request = require('../util/request.js');
const cheerio = require('cheerio');
const answers = require('../util/answers');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events').EventEmitter;

class TriviaTask extends EventEmitter {
  constructor(slug, username, password, api_key) {
    super();

    // Variables
    this.id = Math.random().toString(36).slice(6).toUpperCase();
    this.slug = slug;
    this.username = username;
    this.password = password;
    this.api_key = api_key;
    this.jar = request.jar();
    this.done = false;
    this.taskHeaders = {
      'Cache-Control': 'no-cache',
      Host: 'www.freekigames.com',
      Connection: 'keep-alive',
      'X-Forwarded-For':
        Math.floor(Math.random() * 255) +
        1 +
        '.' +
        Math.floor(Math.random() * 255) +
        '.' +
        Math.floor(Math.random() * 255) +
        '.' +
        Math.floor(Math.random() * 255),
    };
    this.options = { headers: this.taskHeaders, jar: this.jar };

    this.ctx = null;

    // Constants
    this.LOGIN_URL = 'https://www.freekigames.com/auth/popup/login.theform';
    this.HOME_URL = 'https://www.freekigames.com/';
    this.QUIZFORM =
      'https://www.freekigames.com/freegameslanding.freekigames.quizform.quizform';
    this.CAPTCHA_IMAGE_URL = 'https://www.freekigames.com/Captcha?mode=ua';
    this.CAPTCHA_POST_URL =
      'https://www.freekigames.com/auth/popup/loginwithcaptcha.captcha.captcha:internalevent';
    this.CAPTCHA_URL =
      'https://www.freekigames.com/auth/popup/LoginWithCaptcha/freekigames?fpSessionAttribute=QUIZ_SESSION';
    this.CROWN_URL =
      'https://www.freekigames.com/auth/popup/loginwithcaptcha.theform';

    // Listeners
    this.on('solved', async () => {
      await this.getCaptcha();
    });

    this.on('captcha', async () => {
      await this.solveCaptcha();
    });

    this.on('captchaSolution', async (solution) => {
      await this.checkCaptchaSolution(solution);
    });

    this.on('verify', async (solution) => {
      await this.getCrowns(solution);
    });
  }

  async log(data, color = 'white') {
    console.log(
      chalk.blueBright(`[User: ${this.username}]`),
      chalk.magentaBright(`[${this.slug}]`),
      chalk[color](`${data}`)
    );
  }

  getCookies() {
    return this.jar
      .getCookieString('https://www.freekigames.com/')
      .split(';')
      .map(function (c) {
        return c.trim().split('=').map(decodeURIComponent);
      })
      .reduce(function (a, b) {
        try {
          a[b[0]] = JSON.parse(b[1]);
        } catch (e) {
          a[b[0]] = b[1];
        }
        return a;
      }, {});
  }

  async getContext() {
    // Get current quiz state
    this.ctx = await request({
      method: 'GET',
      url: `${this.HOME_URL}${this.slug}`,
      ...this.options,
    });
  }

  async solveQuestion() {
    await this.getContext();
    if (this.ctx.includes('You completed')) {
      this.log('Quiz Complete');

      this.emit('solved');
      this.done = true;
    } else if (this.ctx.includes('Come Back Tomorrow!')) {
      this.log('Quiz limit reached');
      this.done = true;
    } else {
      const $ = cheerio.load(this.ctx);
      const questionId = $('#questionId').val();
      const questionText = $('.quizQuestion').text();
      const fallback = $('.checkbox').val();
      const answerId = answers[questionId] || fallback;

      const form = {
        't:ac': this.slug,
        't:submit': 'submit',
        stk: '',
        't:formdata':
          'H4sIAAAAAAAAAI2PsUoDQRCGJ0KCaKeljYWlbIJgoTZWanARIWBht7mdXDZ3N3vZmXjRwtaX8QH0oWytnUuwEJtUs/yz/PN971/QbU5gcJUQr12FbB35QPn5RIMi5G1k5ovwMomp0geyhEjBc4LLmHLjapdN0YirdZOeT00WE5ZhrLOqIyEJm5vgPdLRfYoZMo8W4yowa8vj2+H+8uCjtwUdC7tZJEmxvNOLAnt25p5cv3SU90eSFOhiWQvs/AIMfTMAsxm0I24wKfIcXgEEtteBVhg43qyCW2ZR5zPVMoX+48Almgb/iK7UxAYq/st+3hazB0vfK9muTHHoW55Oq9Vb9/8AteFBO4wBAAA=',
        questionId,
        answerId,
        submit: '',
      };

      try {
        await request({
          method: 'POST',
          url: this.QUIZFORM,
          form,
          ...this.options,
        });
        this.log(`Solved ${questionText}`);

        if (!this.done) {
          await this.solveQuestion();
        }
      } catch (error) {}
    }
  }

  async getCaptcha() {
    try {
      const res = await request.get({
        uri: this.CAPTCHA_IMAGE_URL,
        encoding: null,
        ...this.options,
      });
      const buffer = Buffer.from(res, 'utf8');
      fs.writeFileSync(
        path.join(__dirname, '../captchas', `${this.id}.png`),
        buffer
      );
      this.emit('captcha');
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async solveCaptcha() {
    try {
      const result = await request({
        method: 'POST',
        url: 'https://api.amusingthrone.com/wizard101/v2/captcha',
        formData: {
          key: this.api_key,
          img: fs.createReadStream(
            path.join(__dirname, '../captchas', `${this.id}.png`)
          ),
        },
      });

      const data = JSON.parse(result);
      if (data.error) {
        this.log('Failed to solve captcha. Refreshing...', 'yellowBright');
        await this.getCaptcha();
      } else {
        this.emit('captchaSolution', data.prediction);
      }
    } catch (error) {
      await this.solveCaptcha();
      return;
    }
  }

  async checkCaptchaSolution(solution) {
    try {
      const result = await request({
        method: 'POST',
        url: this.CAPTCHA_POST_URL,
        form: {
          value: solution,
        },
        ...this.options,
      });
      if (result === 'true') {
        this.log('Captcha result is valid!', 'cyanBright');
        this.emit('verify', solution);
      } else {
        this.log('Result invalid. Refreshing captcha', 'yellow');
        await this.getCaptcha();
      }
    } catch (error) {}
  }

  async getCrowns(solution) {
    this.jar.setCookie('showRegister=block', 'https://www.freekigames.com');

    try {
      const verifyCtx = await request({
        method: 'GET',
        url: this.CAPTCHA_URL,
        ...this.options,
      });

      const formData = this.getFormData(verifyCtx);

      const form = {
        't:ac': 'freekigames',
        't:submit': 'login',
        stk: '',
        't:formdata': formData,
        fpShowRegister: false,
        userName: this.username,
        password: this.password,
        captcha: solution,
        login: '',
      };

      this.log('Logging In & Verifying');

      await request({
        method: 'POST',
        url: this.CROWN_URL,
        form,
        ...this.options,
      });

      const context = await request({
        method: 'GET',
        url: `${this.HOME_URL}${this.slug}`,
        ...this.options,
      });

      if (context.toString().includes('10 Non Transferrable')) {
        this.log('Successfully earned 10 crowns!', 'green');
        return;
      } else {
        this.log('Failed to complete quiz', 'red');
        return;
      }
    } catch (error) {
      //console.error(error);
    }
  }

  getFormData(ctx) {
    const $ = cheerio.load(ctx);
    const formData = $('input[name="t:formdata"]').val();

    return formData;
  }

  async start() {
    while (!this.done) {
      try {
        await this.solveQuestion();
      } catch (error) {}
    }
  }
}

module.exports = TriviaTask;
