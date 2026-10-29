---
title: "HTTP Verb Tampering in NestJS: Bypassing Middleware with HEAD Requests"
date: "2026-02-09"
summary: "How Express treating HEAD as GET lets NestJS middleware scoped to GET miss auth — and mutate state anyway."
lang: "en"
medium_url: "https://medium.com/@deeptester/http-verb-tampering-in-nestjs-bypassing-middleware-with-head-requests-e70b968b15c2"
draft: true
---

HTTP Verb Tampering is an old attack that still shows up in modern stacks. Authentication and access control often lock down the common verbs (GET, POST, PUT) and leave the rest open.

> “HTTP Verb Tampering is an attack that exploits vulnerabilities in the authentication and access control mechanisms of HTTP verbs (also known as HTTP methods). Many authentication mechanisms only restrict access to the most common HTTP methods, allowing unauthorized access to restricted resources using other HTTP methods.” — [Imperva](https://www.imperva.com/learn/application-security/http-verb-tampering)

## GET vs HEAD

**GET** asks for a representation of a resource. It should only retrieve data and should not carry a request body.

**HEAD** asks for the same response as GET, but without a body. ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods))

Many frameworks treat HEAD like GET. Express documents this explicitly, and the router does it in code:

```js
Route.prototype._handlesMethod = function _handlesMethod (method) {
  if (this.methods._all) {
    return true
  }
  // normalize name
  let name = typeof method === 'string'
    ? method.toLowerCase()
    : method
  if (name === 'head' && !this.methods.head) {
    name = 'get'
  }
// https://github.com/pillarjs/router/blob/master/lib/route.js#L64
```

That mapping is the hinge for NestJS.

## The problem in NestJS

NestJS sits on Express by default. It adds Middleware, Guards, and the rest, but routing still follows Express. The middleware docs push a pattern like “apply this middleware to `RequestMethod.GET` on path X.”

Two mistakes stack:

1. Teams put auth/authorization in Nest middleware instead of Guards (what Nest recommends for that job).
2. Middleware is registered only for `RequestMethod.GET`, so HEAD never hits it — while Express still runs the GET handler for HEAD.

A minimal reproduction:

```ts
import 'reflect-metadata';
import {
  Controller,
  Get,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  RequestMethod,
  UnauthorizedException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';

@Injectable()
class ApiKeyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const apiKey = req.header('x-api-key');
    const validApiKey = process.env.API_KEY || 'mi-api-key-secreta';
    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('API key invalida');
    }
    next();
  }
}

@Injectable()
class CatsService {
  private counter = 0;
  incrementAndGetCount() {
    this.counter += 1;
    console.log("Actual counter: " + this.counter)
    return this.counter;
  }
}

@Controller('cats')
class CatsController {
  constructor(private readonly catsService: CatsService) {}
  @Get()
  getCats() {
    const count = this.catsService.incrementAndGetCount();
    return {
      message: 'Counter: ' + count,
      count,
    };
  }
}

@Module({
  controllers: [CatsController],
  providers: [CatsService],
})
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApiKeyMiddleware)
      .forRoutes({ path: 'cats', method: RequestMethod.GET });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}
bootstrap();
```

The dangerous line is the route filter:

```ts
.forRoutes({ path: 'cats', method: RequestMethod.GET });
```

Observed behavior:

- **GET with a valid API key** — middleware allows it; the counter increments (side effect on a GET).
- **GET without an API key** — middleware blocks it.
- **HEAD without an API key** — middleware never runs; Express maps HEAD → GET handler; response is 200 with empty body; **the counter still increments**.

No body comes back, but the handler ran. If your “GET” mutates state, HEAD becomes an unauthenticated write.

## Takeaway

Verb tampering is old; Nest + Express still make it easy. Put auth in Guards (or at least register HEAD alongside GET in middleware), and keep GETs free of side effects. Add HEAD (and other verbs) to your AppSec checklist.

## Related reading

- [HTTP HEAD and security](https://security.stackexchange.com/questions/111616/http-head-and-its-security-versus-operational-uses)
- [NestJS HEAD vs GET on the same route](https://stackoverflow.com/questions/79090501/nestjs-using-head-http-request-type-and-get-for-the-same-route)
- [SANS: Dangerous HTTP methods](https://www.sans.org/reading-room/whitepapers/testing/penetration-testing-web-application-dangerous-http-methods-33945)
- [OWASP: Test HTTP Methods](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods)
