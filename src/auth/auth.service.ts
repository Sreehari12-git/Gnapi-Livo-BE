import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto';
import bcrypt from "bcrypt"
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { ControlPanelRegisterDto } from './dto/control-panel-register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async admLogin(loginDto: LoginDto) {
  const { email, password } = loginDto;

  const user = await this.prisma.adminLogin.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const accessToken = await this.jwtService.signAsync(
    {
      id: user.id,
      email: user.email,
    },
    {
      secret: process.env.JWT_SECRET,
      expiresIn: '2h',
    },
  );

  const refreshToken = await this.jwtService.signAsync(
    {
      id: user.id,
    },
    {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    },
  );

  return {
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

  async adminRegister(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    const existingUser = await this.prisma.adminLogin.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.adminLogin.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const accessToken = await this.jwtService.signAsync(
      {
        id: user.id,
        email: user.email,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '2h',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        id: user.id,
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    return {
      message: 'Admin registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async controlPanelRegister(registerDto: ControlPanelRegisterDto) {
  const { name, email, password, adminId } = registerDto;

  const existingUser = await this.prisma.controlPanelLogin.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new ConflictException('Email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await this.prisma.controlPanelLogin.create({
    data: {
      name,
      email,
      password: hashedPassword,
      admin: { connect: {id: adminId}},
    },
  });

  const accessToken = await this.jwtService.signAsync(
    {
      id: user.id,
      email: user.email,
      role: 'control_panel',
    },
    {
      secret: process.env.JWT_SECRET,
      expiresIn: '2h',
    },
  );

  const refreshToken = await this.jwtService.signAsync(
    {
      id: user.id,
    },
    {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    },
  );

  return {
    message: 'Control panel user registered successfully',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

async controlPanelLogin(loginDto: LoginDto) {
  const { email, password } = loginDto;

  const user = await this.prisma.controlPanelLogin.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const accessToken = await this.jwtService.signAsync(
    {
      id: user.id,
      email: user.email,
      role: 'control_panel',
    },
    {
      secret: process.env.JWT_SECRET,
      expiresIn: '2h',
    },
  );

  const refreshToken = await this.jwtService.signAsync(
    {
      id: user.id,
    },
    {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    },
  );

  return {
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      adminId: user.adminId,
    },
  };
}
}

