import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create.event.dto';
import { connect } from 'http2';
import { UpdateEventDto } from './dto/update-event.dto';
import { ValidateSessionDto } from './dto/validate.session.dto';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) { }

  async createEvent(createEventDto: CreateEventDto) {
    const { name, adminId, category, sport } = createEventDto;

    const event = await this.prisma.eventInfo.create({
      data: {
        name,
        category,
        sport: sport ?? null,
        creator: {
          connect: { id: adminId }
        }
      },
    });

    return {
      message: 'Event created successfully',
      event: {
        id: event.id,
        name: event.name,
        category: event.category,
        sport: event.sport,
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

  async getEventsByAdmin(adminId: number) {
    const events = await this.prisma.eventInfo.findMany({
      where: { createdBy: adminId },
      orderBy: { id: 'desc' },
    });

    return events;
  }

  async getEventById(id: string) {
    const event = await this.prisma.eventInfo.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
          },
        },
        matchHistories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      message: 'Event retrieved successfully',
      event,
    };
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
        ...(updateEventDto.name !== undefined && { name: updateEventDto.name }),
        ...(updateEventDto.category !== undefined && { category: updateEventDto.category }),
        ...(updateEventDto.sport !== undefined && { sport: updateEventDto.sport }),
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
