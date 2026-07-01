import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ControlPanelRegisterDto } from './dto/control-panel-register.dto';

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

  @Post('control-panel/register')
  controlPanelRegister(
    @Body() registerDto: ControlPanelRegisterDto,
  ) {
    return this.authService.controlPanelRegister(registerDto);
  }

  @Post('control-panel/login')
  controlPanelLogin(@Body() loginDto: LoginDto) {
    return this.authService.controlPanelLogin(loginDto);
  }
}

