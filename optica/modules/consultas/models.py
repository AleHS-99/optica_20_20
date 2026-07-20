from django.db import models
from modules.paciente.models import Paciente

# Create your models here.
class consultaModel(models.Model):
    class Meta:
        verbose_name = 'Consulta'
        verbose_name_plural = 'Consultas'
        ordering = ['-created']
     
    id = models.AutoField(primary_key=True)
    paciente = models.ForeignKey(
        Paciente, 
        on_delete=models.CASCADE, 
        related_name='consultas'
    )
    refraccion = models.CharField(max_length=100, blank=True, default='')
    ojo_derecho = models.CharField(max_length=100, blank=True, default='')
    ojo_izquierdo = models.CharField(max_length=100, blank=True, default='')
    add = models.CharField(max_length=50, blank=True, default='')
    galenos = models.CharField(max_length=100, blank=True, default='')
    corta_y_monta = models.CharField(max_length=100, blank=True, default='')
    observaciones = models.TextField(blank=True, default='')
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    
    
    @property
    def es_hoy(self):
        from django.utils import timezone
        return self.created.date() == timezone.now().date()