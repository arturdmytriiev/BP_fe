import { Auth } from "@auth/core";
import { authConfig } from "@/auth";
import { APP_BASE_PATH } from "@/lib/base-path";

function withExternalAuthPath(request: Request) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(APP_BASE_PATH)) {
        url.pathname = `${APP_BASE_PATH}${url.pathname}`;
    }

    return new Request(url, request);
}

async function handler(request: Request) {
    return Auth(withExternalAuthPath(request), authConfig);
}

export const GET = handler;
export const POST = handler;
