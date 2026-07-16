import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create.event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ValidateSessionDto } from './dto/validate.session.dto';
import { SaveDeviceEventHistoryDto } from './dto/device-event-history.dto';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post('create')
  async createEvent(@Body() createEventDto: CreateEventDto, @Req() req) {
    return this.eventService.createEvent(createEventDto);
  }

  @Get('all')
  async getAllEvents() {
   return this.eventService.getAllEvents();
  }

  @Get('admin/:adminId')
  async getEventsByAdmin(@Param('adminId') adminId: string) {
    return this.eventService.getEventsByAdmin(Number(adminId));
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return this.eventService.getEventById(id);
  }

  @Patch(':id')
  async updateEvent(@Param('id') id: string,
  @Body() updateEventDto: UpdateEventDto) {
   return this.eventService.updateEvent(id, updateEventDto);
  }

  @Delete(':id')
  async deleteEvent(@Param('id') id: string) {
    return this.eventService.deleteEvent(id);
  }

  @Post('validate')
  async validateSession(@Body() validateSessionDto: ValidateSessionDto,) {
    return this.eventService.validateSession(validateSessionDto);
  }

  @Post('history')
  async saveHistory(@Body() dto: SaveDeviceEventHistoryDto) {
    return this.eventService.saveDeviceEventHistory(dto);
  }

  @Get('history/:deviceId')
  async getHistory(@Param('deviceId') deviceId: string) {
    return this.eventService.getDeviceEventHistory(deviceId);
  }
}