export const APP_BASE_PATH = "/bp-fe";
export const AUTH_BASE_PATH = `${APP_BASE_PATH}/api/auth`;

export function withBasePath(path: string) {
    if (path.startsWith(APP_BASE_PATH)) {
        return path;
    }

    if (path === "/") {
        return APP_BASE_PATH;
    }

    return `${APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export function stripBasePath(pathname: string) {
    if (!pathname.startsWith(APP_BASE_PATH)) {
        return pathname;
    }

    const stripped = pathname.slice(APP_BASE_PATH.length);
    return stripped.length > 0 ? stripped : "/";
}
