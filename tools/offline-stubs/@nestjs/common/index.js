class NotFoundException extends Error {}
class BadRequestException extends Error {}
class ForbiddenException extends Error {}
class UnauthorizedException extends Error {}
class ConflictException extends Error {}
exports.NotFoundException = NotFoundException;
exports.BadRequestException = BadRequestException;
exports.ForbiddenException = ForbiddenException;
exports.UnauthorizedException = UnauthorizedException;
exports.ConflictException = ConflictException;
exports.Injectable = () => (t) => t;
exports.Controller = () => (t) => t; exports.Module = () => (t) => t;
exports.Get = () => () => {}; exports.Post = () => () => {}; exports.Delete = () => () => {};
exports.Put = () => () => {}; exports.Patch = () => () => {};
exports.Body = () => () => {}; exports.Param = () => () => {}; exports.Query = () => () => {}; exports.Req = () => () => {};
exports.UseGuards = () => () => {}; exports.SetMetadata = () => () => {}; exports.applyDecorators = (...a) => () => {};
exports.CanActivate = class CanActivate {}; exports.ExecutionContext = class ExecutionContext {};
