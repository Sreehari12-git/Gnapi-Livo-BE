import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ControlPanelRegisterDto } from './dto/control-panel-register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  async adminLogin(@Body() loginDto: LoginDto) {
    return this.authService.admLogin(loginDto);
  }

  @Post('admin/register')
  async adminRegister(@Body() registerDto: RegisterDto) {
    return this.authService.adminRegister(registerDto);
  }

  @Post('admin/change-password')
  changeAdminPassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changeAdminPassword(dto);
  }

  @Post('control-panel/register')
  controlPanelRegister(@Body() registerDto: ControlPanelRegisterDto) {
    return this.authService.controlPanelRegister(registerDto);
  }

  @Post('control-panel/login')
  controlPanelLogin(@Body() loginDto: LoginDto) {
    return this.authService.controlPanelLogin(loginDto);
  }
}
