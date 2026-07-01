import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create.event.dto';
import { connect } from 'http2';
import { UpdateEventDto } from './dto/update-event.dto';
import { ValidateSessionDto } from './dto/validate.session.dto';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(createEventDto: CreateEventDto) {
    const { name, adminId } = createEventDto;

    const event = await this.prisma.eventInfo.create({
      data: {
        name,
        creator:{
            connect: {id: adminId}
        } 
      },
    });

    return {
      message: 'Event created successfully',
      event: {
        id: event.id,
        name: event.name,
        createdBy: event.createdBy,
      },
    };
  }

  async getAllEvents() {
  const events = await this.prisma.eventInfo.findMany({
    include: {
      creator: {
        select: {
          id: true,
          email: true, 
        },
      },
    },
    orderBy: {
      id: 'desc',
    },
  });

  return events;
}

async updateEvent(id: string, updateEventDto: UpdateEventDto) {
  const existingEvent = await this.prisma.eventInfo.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    throw new NotFoundException('Event not found');
  }

  const updatedEvent = await this.prisma.eventInfo.update({
    where: { id },
    data: {
      name: updateEventDto.name,
    },
  });

  return updatedEvent;
}

async deleteEvent(id: string) {
  const existingEvent = await this.prisma.eventInfo.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    throw new NotFoundException('Event not found');
  }

  await this.prisma.eventInfo.delete({
    where: { id },
  });

  return { message: 'Event deleted successfully' };
}


async validateSession(dto: ValidateSessionDto) {
  const { adminId, eventId } = dto;

  const event = await this.prisma.eventInfo.findFirst({
    where: {
      id: eventId,
      createdBy: adminId,
    },
  });

  if (!event) {
    throw new NotFoundException(
      'Admin or Event not found'
    );
  }

  return {
    message: 'Session validated',
    event,
  };
}
}
